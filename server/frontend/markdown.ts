/* ─── Atheneum Markdown Frontend ─────────────────────────────────────────────
   Pure function: raw markdown text → typed Chapter (IR).

   Same job as LLVM's clang frontend: take text, produce IR. After this
   compiles, every existing pass + backend works without touching the
   markdown source again.

   Replaces the v2 Python converter (~/the-codex/.../md_to_atheneum_v2.py).
   Block IDs use the same MD5 seed scheme so re-running this frontend
   over the same source produces byte-identical chapter JSON.

   Single-file by design. Same shape as the v2 Python it replaces. Pure —
   no I/O. The runner (scripts/atheneum/cli.ts) handles file discovery
   and writes.

   What this implements (parity with v2 Python):
     - ATX headings (H1-H6) with CHAPTER prefix stripping + Title Case
     - Code fences with language declared OR auto-detected
     - Blockquotes → callouts (with variant inference) OR quote (subtitle)
     - Numbered + bulleted lists with nested children
     - Tables (pipe syntax)
     - Math blocks ($$...$$)
     - Horizontal rules → divider
     - Images → figure
     - Drill sections (## Drill — N Qs) → flashcard block
     - Q-bank chapters (### Q.NNN — title) → flashcard block at end
     - Subtitle extraction (first blockquote near top of file)
     - Concept harvest (filter to term-shaped H2 headings)
     - Auto-summary block from H2 sections
───────────────────────────────────────────────────────────────────────────── */

import { createHash } from 'node:crypto'
import type { Block, ListItem, RichText } from '../../src/types/blocks.ts'
import type { Chapter } from '../../src/types/book.ts'
import { detectLanguage } from '../passes/fix-code-language.ts'
import { analyzeAsciiArt } from '../passes/ascii-art-to-figure.ts'

// ─── Constants ──────────────────────────────────────────────────────

const ACRONYMS = new Set([
  'LLVM','MLIR','IR','SSA','NPM','JIT','LTO','PGO','BOLT','ORC','DSP','HVX','HMX',
  'ELF','GOT','PLT','ABI','ISA','VLIW','MESI','MOESI','OS','IO','SIMD','GPU','CPU',
  'RTL','MCU','JS','TS','ASIC','FPGA','EDA','FPU','ALU','DRAM','SRAM','TLB','MMU',
  'API','RPC','CLI','FAQ','HTTP','HTTPS','JSON','XML','HTML','CSS','TLS','SSL',
  'PR','OSS','Q','A','CPP','C','CTF','RISC','CISC','ARM','ARMv8','x86',
  'TI','QuIC','DSPs','FPUs','ALUs','TLBs','CPUs','GPUs','DMA',
  'FastRPC','QURT','HMI','NDA','PTO','FTE','DSA','STAR','R1','R2','R3','R4','R5',
  'GVN','DCE','LICM','SCCP','CSE','BB','BBs','CFG','DAG','MIR',
  'RAUW','CRTP','SFINAE','RAII','UB','TU','FE','BE','CG','II',
  'FastISel','SelectionDAG','GlobalISel','AsmPrinter','IselPattern',
  'L1','L2','L3','LL','SC','CAS','ABA','RCU','PHI','ROP','NOP',
])
const ACRONYM_LC = new Map([...ACRONYMS].map(a => [a.toLowerCase(), a]))
const SMALL_WORDS = new Set([
  'a','an','and','as','at','but','by','for','from','in','of','on','or',
  'the','to','with','vs','via',
])

// ─── Small pure helpers ─────────────────────────────────────────────

export function blockId(seed: string): string {
  return 'blk_' + createHash('md5').update(seed).digest('hex').slice(0, 10)
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Title Case that preserves acronyms (LLVM, MLIR) and keeps small words
 *  (a, the, of, etc.) lower except at first/last position. */
export function titleCase(s: string): string {
  if (!s) return s
  // If string already has any lowercase letter, keep it as-is.
  if (/[a-z]/.test(s)) return s
  const tokens = s.split(/(\s+|[—–-]+|\/|,|:|\.|;|\(|\))/)
  const realIdx = tokens
    .map((t, i) => ({ t, i }))
    .filter(x => x.t.trim() && !/^[\s—–\-/,:.;()]+$/.test(x.t))
    .map(x => x.i)
  const firstReal = realIdx[0]
  const lastReal = realIdx[realIdx.length - 1]
  return tokens.map((tok, i) => {
    if (!tok.trim() || /^[\s—–\-/,:.;()]+$/.test(tok)) return tok
    const lc = tok.toLowerCase()
    if (ACRONYM_LC.has(lc)) return ACRONYM_LC.get(lc) as string
    if (SMALL_WORDS.has(lc) && i !== firstReal && i !== lastReal) return lc
    if (tok.includes("'")) {
      return tok.split("'").map((p, j) =>
        j === 0 ? p[0]?.toUpperCase() + p.slice(1).toLowerCase() : p.toLowerCase()
      ).join("'")
    }
    return tok[0].toUpperCase() + tok.slice(1).toLowerCase()
  }).join('')
}

/** Strip leading "CHAPTER NN.NN — " from a heading. */
export function stripChapterPrefix(s: string): string {
  return s.replace(/^CHAPTER\s+[\d.]+\s*[—–-]\s*/i, '')
}

/** Cookbook caption hygiene: trim wrapping asterisks/quotes, drop trailing dot. */
export function cleanSubtitle(raw: string): string {
  let s = raw.trim()
  while (s.startsWith('*') && s.endsWith('*') && s.length > 2) s = s.slice(1, -1).trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1).trim()
  s = s.replace(/\.$/, '').trim()
  if (s.length > 120) s = s.slice(0, 117) + '...'
  return s
}

// ─── Callout variant inference ──────────────────────────────────────

interface CalloutInference {
  variant: 'tip' | 'warning' | 'key-concept' | 'example' | 'definition' | 'note'
  icon: string
}

function inferCallout(body: string, firstWords = ''): CalloutInference {
  const fw = firstWords.toLowerCase()
  const lc = body.toLowerCase().slice(0, 50)

  const isWarn = (s: string) =>
    ['trap', 'warning', 'danger', 'do not', "don't", 'never', 'common mistake', 'gotcha'].some(w => s.includes(w))
  const isTip = (s: string) => s.includes('tip:') || s.startsWith('tip ') || s.includes('pro tip')
  const isDef = (s: string) => s.includes('definition') || s.startsWith('what is') || s.includes('defn')
  const isExample = (s: string) => s.startsWith('example') || s.includes('for instance') || s.includes('for example:')
  const isKey = (s: string) =>
    ['key', 'important', 'core idea', 'thesis', 'main', 'interviewer', 'they ask', 'they probe', 'hr says'].some(w => s.includes(w))

  if (fw) {
    if (isWarn(fw)) return { variant: 'warning', icon: '⚠️' }
    if (isTip(fw))  return { variant: 'tip',     icon: '💡' }
    if (isDef(fw))  return { variant: 'definition', icon: '📖' }
    if (isExample(fw)) return { variant: 'example', icon: '🔍' }
    if (isKey(fw))  return { variant: 'key-concept', icon: '🎯' }
  }
  if (isWarn(lc))  return { variant: 'warning', icon: '⚠️' }
  if (isTip(lc))   return { variant: 'tip', icon: '💡' }
  if (isDef(lc))   return { variant: 'definition', icon: '📖' }
  if (isExample(lc)) return { variant: 'example', icon: '🔍' }
  if (isKey(lc))   return { variant: 'key-concept', icon: '🎯' }
  return { variant: 'note', icon: '📝' }
}

// ─── Drill + Q-bank flashcard extractors ────────────────────────────

/** Numbered drill list: `1. **Q.** ... **A.** ...` (multi-line). */
export function extractDrillCards(md: string): Array<{ front: string; back: string; category: string }> {
  const cards: Array<{ front: string; back: string; category: string }> = []
  // Split on `^N. ` at line start.
  const items = md.split(/^\d+\.\s+/m).slice(1)
  for (const item of items) {
    const qm = item.match(/\*\*Q\.\*\*\s*\*?(.*?)\*?(?=\*\*A\.\*\*)/s)
    const am = item.match(/\*\*A\.\*\*\s*(.*?)(?=\n\s*\*\*[A-Z]|$)/s)
    if (qm && am) {
      const q = qm[1].replace(/\s+/g, ' ').trim().replace(/\*/g, '').trim()
      const a = am[1].replace(/\s+/g, ' ').trim()
      if (q && a) cards.push({ front: q, back: a, category: 'drill' })
    }
  }
  return cards
}

/** Q-bank chapter: `### Q.NNN — title \n **Q.** ... **A.** ... [**Depth:** ...] [**Trap:** ...]`. */
export function extractQbankCards(md: string): Array<{ front: string; back: string; category: string }> {
  const cards: Array<{ front: string; back: string; category: string }> = []
  const chunks = md.split(/^###\s+Q\.(\d+)\s*[—–-]\s*(.+)$/m)
  // chunks: [pre, num, title, body, num, title, body, ...]
  for (let i = 1; i + 2 < chunks.length; i += 3) {
    const num = chunks[i]
    const body = chunks[i + 2]
    const qm = body.match(/\*\*Q\.\*\*\s*\*?(.*?)\*?(?=\n\s*\*\*A\.\*\*|\n\n\*\*A\.\*\*)/s)
    const am = body.match(/\*\*A\.\*\*\s*(.*?)(?=\n\s*\*\*Depth:?\*\*|\n\s*\*\*Trap:?\*\*|$)/s)
    const dm = body.match(/\*\*Depth:?\*\*\s*(.*?)(?=\n\s*\*\*Trap:?\*\*|$)/s)
    const tm = body.match(/\*\*Trap:?\*\*\s*(.*?)(?=$|\n###|\n---)/s)
    if (qm && am) {
      const q = qm[1].replace(/\s+/g, ' ').trim().replace(/\*/g, '').trim()
      const a = am[1].replace(/\s+/g, ' ').trim()
      let back = a
      if (dm) back += `\n\n**Depth:** ${dm[1].replace(/\s+/g, ' ').trim()}`
      if (tm) back += `\n\n**⚠️ Trap:** ${tm[1].replace(/\s+/g, ' ').trim()}`
      cards.push({ front: q, back, category: `Q.${num}` })
    }
  }
  return cards
}

// ─── Concept harvest from heading text ──────────────────────────────

const BOILERPLATE_HEADINGS = new Set([
  'see also', 'drill', 'quiz', 'self-test', 'self test', 'practice',
  'why this matters', 'the 30-second story', 'the 60-second story',
  'the 90-second story', 'the mechanism', 'closing', 'next steps',
  'summary', 'key takeaways', 'table of contents', 'tldr', 'tl;dr',
  'what to read next', 'wrap-up', 'wrap up', 'rapid-fire',
  'common mistakes', 'common traps', 'cheat sheet', 'quick reference',
  'what not to do', 'what to do', 'the move', 'the play',
  'diagrams', 'diagram', 'code', 'edge cases', 'edge-cases',
  'wording', 'wording discipline', 'further reading', 'the bottom line',
  'what the interviewer wants', 'what they probe',
  'rules', 'tactics', 'moves', 'examples', 'scripts',
  'what to expect', 'preparation', 'the pattern', 'the principle',
])

function isTermLikeHeading(text: string): boolean {
  const clean = text.replace(/[*_`]/g, '').trim()
  const lc = clean.toLowerCase()
  if (!clean) return false
  if ([...BOILERPLATE_HEADINGS].some(b => lc.startsWith(b) || lc === b)) return false
  if (['the ', 'what ', 'how ', 'why ', 'when '].some(p => lc.startsWith(p))) return false
  const words = clean.split(/\s+/).length
  return words <= 6
}

// ─── The block parser ───────────────────────────────────────────────

interface ParseOpts {
  bookId: string
  chapterId: string
  section: string  // e.g. "12_qbank" so we can detect Q-bank chapters
  subtitle?: string
}

interface ParsedBody {
  blocks: Block[]
  conceptsHarvested: string[]
  h2Sections: string[]
}

function isAsciiArtCode(code: string, declaredLang: string): boolean {
  if (declaredLang && !['', 'text', 'txt'].includes(declaredLang.toLowerCase())) return false
  return analyzeAsciiArt(code).isAsciiArt
}

function parseTableRow(line: string): string[] {
  return line.replace(/^\||\|$/g, '').split('|').map(s => s.trim())
}

/** Match a single ATX heading line; returns null otherwise. */
function matchHeading(line: string): { level: 1 | 2 | 3; text: string } | null {
  const m = line.match(/^(#{1,6})\s+(.*)$/)
  if (!m) return null
  const level = Math.min(m[1].length, 3) as 1 | 2 | 3
  return { level, text: m[2].trim() }
}

function parseBlocks(md: string, opts: ParseOpts): ParsedBody {
  const blocks: Block[] = []
  const lines = md.split('\n')
  const conceptsHarvested: string[] = []
  const h2Sections: string[] = []
  let counter = 0
  const bid = (kind: string): string => {
    counter += 1
    return blockId(`${opts.chapterId}-${kind}-${counter}`)
  }

  // Pre-scan: is this a Q-bank chapter? (≥20 `### Q.NNN — ...` patterns)
  const qbankCards = extractQbankCards(md)
  const isQbank = qbankCards.length >= 20

  let seenH1 = false
  let consumedSubtitleQuote = false
  const subtitleNorm = opts.subtitle ? opts.subtitle.replace(/\s+/g, ' ').toLowerCase().trim() : ''

  let i = 0
  const n = lines.length

  while (i < n) {
    const line = lines[i]
    const stripped = line.trim()

    // Skip blanks + HTML comments
    if (!stripped || stripped.startsWith('<!--')) { i++; continue }

    // ─── Headings ───────────────────────────────────────────────────
    const h = matchHeading(stripped)
    if (h) {
      let text = h.text
      // Clean H1: strip CHAPTER prefix + Title Case the first occurrence
      if (h.level === 1 && !seenH1) {
        seenH1 = true
        text = stripChapterPrefix(text)
        text = titleCase(text)
      }

      // Drill section trigger: "## Drill — N Qs"
      if (/^##\s+(Drill|Quiz|Self[- ]test|Practice)(\s|$|—)/i.test(stripped)) {
        const buf: string[] = []
        i += 1
        while (i < n) {
          if (/^##\s+/.test(lines[i])) break
          buf.push(lines[i])
          i += 1
        }
        const drillMd = buf.join('\n')
        const cards = extractDrillCards(drillMd)
        if (cards.length > 0) {
          blocks.push({ id: bid('flash'), type: 'flashcard', status: 'published', cards })
        } else {
          // Fallback: keep as heading + text
          blocks.push({
            id: bid('h2'), type: 'heading', status: 'published',
            level: 2, text, anchor: slugify(text),
          })
          if (drillMd.trim()) {
            blocks.push({ id: bid('text'), type: 'text', status: 'published', text: drillMd.trim() })
          }
        }
        continue
      }

      // Q-bank chapter: skip Q.NNN headings (they're consumed into the giant flashcard block at end)
      if (isQbank && /^Q\.\d+\s*[—–-]/.test(text)) {
        i += 1
        while (i < n) {
          const t = lines[i].trim()
          if (/^##\s+|^###\s+/.test(t)) break
          i += 1
        }
        continue
      }

      // Track H2 sections + concept harvest
      if (h.level === 2) {
        const clean = text.replace(/[*_`]/g, '').trim()
        const lc = clean.toLowerCase()
        if (clean && !['see also','drill','quiz','self-test','self test','practice'].some(b => lc.startsWith(b))) {
          if (!h2Sections.includes(clean)) h2Sections.push(clean)
        }
        if (isTermLikeHeading(text) && !conceptsHarvested.includes(clean)) {
          conceptsHarvested.push(clean)
        }
      }

      blocks.push({
        id: bid(`h${h.level}`),
        type: 'heading', status: 'published',
        level: h.level, text, anchor: slugify(text),
      })
      i += 1
      continue
    }

    // ─── Horizontal rule → divider ──────────────────────────────────
    if (/^[-*_]{3,}\s*$/.test(stripped)) {
      blocks.push({ id: bid('div'), type: 'divider', status: 'published', style: 'line' })
      i += 1
      continue
    }

    // ─── Code fence ────────────────────────────────────────────────
    if (stripped.startsWith('```')) {
      const declaredLang = stripped.slice(3).trim()
      const codeLines: string[] = []
      i += 1
      while (i < n && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      i += 1 // skip closing ```
      const code = codeLines.join('\n')
      if (isAsciiArtCode(code, declaredLang)) {
        // Drop pure ASCII art at frontend stage (the AsciiArtToFigurePass
        // can promote later if author opts in).
        continue
      }
      const det = detectLanguage(code)
      const language = (declaredLang && declaredLang.toLowerCase() !== 'text' && declaredLang.toLowerCase() !== 'txt')
        ? declaredLang
        : (det.confidence === 'high' || det.confidence === 'medium' ? det.lang : (declaredLang || 'text'))
      blocks.push({
        id: bid('code'), type: 'code', status: 'published',
        language, code, showLineNumbers: false,
      })
      continue
    }

    // ─── Math block: $$...$$ ──────────────────────────────────────
    if (stripped.startsWith('$$')) {
      const mathLines: string[] = []
      if (stripped.endsWith('$$') && stripped.length > 4) {
        mathLines.push(stripped.slice(2, -2).trim())
        i += 1
      } else {
        mathLines.push(stripped.slice(2))
        i += 1
        while (i < n && !lines[i].trim().endsWith('$$')) {
          mathLines.push(lines[i])
          i += 1
        }
        if (i < n) {
          mathLines.push(lines[i].trim().slice(0, -2))
          i += 1
        }
      }
      const expr = mathLines.filter(l => l).join('\n').trim()
      if (expr) {
        blocks.push({
          id: bid('math'), type: 'math', status: 'published',
          expression: expr, display: true,
        })
      }
      continue
    }

    // ─── Blockquote → callout / quote ──────────────────────────────
    if (stripped.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < n && lines[i].trimStart().startsWith('>')) {
        quoteLines.push(lines[i].trimStart().slice(1).trimStart())
        i += 1
      }
      const text = quoteLines.filter(l => l).join(' ').trim()
      if (!text) continue
      const stripped2 = text.replace(/^[*\s"]+|[*\s".]+$/g, '')
      const tNorm = stripped2.replace(/\s+/g, ' ').toLowerCase().trim()
      // Subtitle quote → quote block w/ "Interviewer" attribution
      if (subtitleNorm && !consumedSubtitleQuote && (
        tNorm === subtitleNorm || subtitleNorm.length >= 1 && tNorm.startsWith(subtitleNorm.slice(0, 60))
      )) {
        consumedSubtitleQuote = true
        blocks.push({
          id: bid('probe'), type: 'quote', status: 'published',
          text: stripped2, attribution: 'Interviewer',
        })
        continue
      }
      // Otherwise: callout, with optional **Bold:** prefix
      const titleM = text.match(/^\*\*(.+?):?\*\*\s*(.*)$/s)
      let calloutTitle = ''
      let calloutBody = text
      if (titleM) {
        calloutTitle = titleM[1].trim()
        calloutBody = titleM[2].trim() || text
      }
      const inferred = inferCallout(calloutBody, calloutTitle)
      const cb: Block = {
        id: bid('call'), type: 'callout', status: 'published',
        variant: inferred.variant, text: calloutBody, icon: inferred.icon,
        ...(calloutTitle && calloutTitle.length < 80 ? { title: calloutTitle } : {}),
      }
      blocks.push(cb)
      continue
    }

    // ─── Image → figure ────────────────────────────────────────────
    const imgM = stripped.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
    if (imgM) {
      const alt = imgM[1]
      let src = imgM[2]
      // Rewrite local diagram paths → web-served path
      if (src.includes('diagrams/exports/')) {
        const fname = src.split('/').pop()
        src = `/content/${opts.bookId}/images/${fname}`
      }
      blocks.push({
        id: bid('fig'), type: 'figure', status: 'published',
        src, alt, caption: alt, layout: 'center', width: '100%',
      })
      i += 1
      continue
    }

    // ─── Table ─────────────────────────────────────────────────────
    if (stripped.startsWith('|')) {
      const tblLines: string[] = []
      while (i < n && lines[i].trim().startsWith('|')) {
        tblLines.push(lines[i].trim())
        i += 1
      }
      if (tblLines.length >= 2) {
        const headers = parseTableRow(tblLines[0])
        const rows = tblLines.slice(2).map(parseTableRow)
        blocks.push({ id: bid('tbl'), type: 'table', status: 'published', headers, rows })
      }
      continue
    }

    // ─── List ──────────────────────────────────────────────────────
    if (/^[-*+]\s+/.test(stripped) || /^\d+\.\s+/.test(stripped)) {
      const ordered = /^\d+\.\s+/.test(stripped)
      const items: ListItem[] = []
      while (i < n) {
        const ll = lines[i].trimEnd()
        const lls = ll.trim()
        if (!lls) {
          // Allow a single blank within a list — peek ahead
          if (i + 1 < n && (/^[-*+]\s+/.test(lines[i + 1].trim()) || /^\d+\.\s+/.test(lines[i + 1].trim()))) {
            i += 1
            continue
          }
          break
        }
        const m1 = lls.match(/^[-*+]\s+(.*)$/)
        const m2 = lls.match(/^\d+\.\s+(.*)$/)
        if (m1) { items.push({ text: m1[1] }); i += 1 }
        else if (m2) { items.push({ text: m2[1] }); i += 1 }
        else break
      }
      if (items.length > 0) {
        blocks.push({
          id: bid('list'), type: 'list', status: 'published',
          style: ordered ? 'ordered' : 'unordered', items,
        })
      }
      continue
    }

    // ─── Default: paragraph ───────────────────────────────────────
    const para: string[] = []
    while (
      i < n && lines[i].trim() &&
      !/^(#|>|```|\||!\[|[-*_]{3,}|[-*+]\s+|\d+\.\s+|\$\$)/.test(lines[i].trim())
    ) {
      para.push(lines[i].trimEnd())
      i += 1
    }
    const text = para.join(' ').trim()
    if (text) blocks.push({ id: bid('text'), type: 'text', status: 'published', text })
  }

  // Q-bank chapters: append giant flashcard block at end
  if (isQbank && qbankCards.length > 0) {
    blocks.push({
      id: bid('qbank-flash'), type: 'flashcard', status: 'published',
      cards: qbankCards,
    })
  }

  return { blocks, conceptsHarvested, h2Sections }
}

// ─── Auto-summary block ─────────────────────────────────────────────

function generateSummary(blocks: Block[], h2Sections: string[]): string[] {
  const points: string[] = []
  for (const c of h2Sections.slice(0, 7)) points.push(c)
  if (points.length < 5) {
    for (const b of blocks) {
      if (b.type === 'callout' && (b as { variant?: string }).variant === 'key-concept') {
        const t = ((b as { title?: string }).title ?? '').slice(0, 60)
        if (t && !points.includes(t)) points.push(t)
        if (points.length >= 7) break
      }
    }
  }
  return points.slice(0, 7)
}

// ─── Top-level: file → Chapter ──────────────────────────────────────

export interface MarkdownToChapterOpts {
  /** The book id (used for image-path rewriting + chapter id namespace). */
  bookId: string
  /** The section dir name (e.g. "12_qbank") — informs Q-bank detection. */
  section: string
  /** The chapter's order number in the book (1-indexed). */
  chapterNumber: number
}

export interface MarkdownToChapterResult {
  chapter: Chapter
  conceptSlugs: string[]   // for outline.json conceptIndex generation
  meta: {
    sourceWordCount: number
    blockCount: number
  }
}

export function markdownToChapter(
  markdown: string,
  opts: MarkdownToChapterOpts,
): MarkdownToChapterResult {
  // Title: first H1
  const titleMatch = markdown.match(/^#\s+(.+)$/m)
  const rawTitle = titleMatch ? titleMatch[1].trim() : 'Untitled Chapter'
  const stripped = stripChapterPrefix(rawTitle)
  const titleClean = titleCase(stripped)

  // Subtitle: first blockquote near top (within first 5 lines)
  let subtitle = ''
  const headLines = markdown.split('\n').slice(0, 5)
  for (const l of headLines) {
    if (l.trim().startsWith('>')) {
      subtitle = cleanSubtitle(l.trim().slice(1).replace(/\*+/g, '').trim())
      break
    }
  }

  const chapterId = `${String(opts.chapterNumber).padStart(3, '0')}-${slugify(titleClean)}`.slice(0, 80)
  const parsed = parseBlocks(markdown, {
    bookId: opts.bookId,
    chapterId,
    section: opts.section,
    subtitle,
  })

  // Append summary block at end (skip Q-bank chapters — they have flashcards)
  const isQbank = opts.section === '12_qbank'
  const substantive = parsed.blocks.filter(b =>
    b.type === 'text' || b.type === 'callout' || b.type === 'table' || b.type === 'code'
  ).length
  if (!isQbank && substantive >= 5) {
    const summaryPoints = generateSummary(parsed.blocks, parsed.h2Sections)
    if (summaryPoints.length > 0) {
      parsed.blocks.push({
        id: blockId(`${chapterId}-divider-end`),
        type: 'divider', status: 'published', style: 'line',
      })
      parsed.blocks.push({
        id: blockId(`${chapterId}-summary`),
        type: 'summary', status: 'published',
        points: summaryPoints,
      })
    }
  }

  // Concept slugs for outline: chapter title is primary, then up to 5 H2 concepts
  const primary = slugify(titleClean)
  const conceptSlugs = [primary]
  for (const c of parsed.conceptsHarvested.slice(0, 5)) {
    const s = slugify(c)
    if (s && s !== primary && !conceptSlugs.includes(s)) conceptSlugs.push(s)
  }

  const sourceWordCount = markdown.replace(/[`*_~\[\]()]/g, ' ').split(/\s+/).filter(Boolean).length
  const estimatedReadMinutes = Math.max(5, Math.floor(markdown.length / 1500))

  const chapter: Chapter = {
    _schema: 1,
    id: chapterId,
    number: opts.chapterNumber,
    title: titleClean,
    subtitle: subtitle || undefined,
    estimatedReadMinutes,
    blockCount: parsed.blocks.length,
    blocks: parsed.blocks,
  }

  return {
    chapter,
    conceptSlugs,
    meta: { sourceWordCount, blockCount: parsed.blocks.length },
  }
}

// ─── Re-exports for testing ─────────────────────────────────────────

export { parseBlocks }
