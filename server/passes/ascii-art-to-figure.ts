/* ─── Pass: AsciiArtToFigure ─────────────────────────────────────────────────
   Detects code blocks whose body is structurally ASCII art (box-drawing
   characters, directory trees, lattice diagrams, horizontal rules) rather
   than programming code, and promotes them to typed diagram blocks with
   engine='custom-svg' so the platform actually counts them as diagrams.

   Why this matters:
     The lint surfaced 169 untagged code blocks across the corpus — most
     concentrated in qualcomm-compiler (0 typed diagrams in 103 chapters).
     The v2 markdown converter stripped ASCII art at parse time but never
     produced replacement blocks. This pass closes the loop: ASCII art that
     IS information becomes a diagram block carrying that information,
     rendered as monospaced SVG so it survives PDF + EPUB + print.

   Detection (high confidence — false-positives would clobber real code):
     1. Contains ≥4 distinct box-drawing characters (Unicode block 2500-257F)
        OR ≥1 directory-tree marker (├──, └──, │) per line on ≥3 lines
        OR ≥2 horizontal rules of length ≥10 (───, ===, ~~~)
     2. AND lacks programming-language signatures (matched by the
        FixCodeLanguage detector — the converse).
     3. AND has multiple lines (single-line strings stay as code).

   Output:
     A diagram block with engine='custom-svg', category='sketchnote' (safe
     default), the original ASCII rendered into an SVG <text> grid, the
     `illustrates` field populated with concept slugs harvested from the
     ASCII text, and a synthesized caption.
───────────────────────────────────────────────────────────────────────────── */

import type { Block } from '../../src/types/blocks.ts'
import type { DiagramBlock } from '../../src/types/diagrams.ts'
import type { BlockPass, BlockPassContext } from './types.ts'
import { detectLanguage } from './fix-code-language.ts'

// ─── Detection ──────────────────────────────────────────────────────

const BOX_CHARS = new Set([
  '┌','└','├','─','│','┐','┘','┤','┬','┴','┼','╴','╶','╷','╵','╿','╾',
  '═','║','╔','╗','╚','╝','╠','╣','╦','╩','╬','▼','▲','▶','◀','▽','△',
  '◆','◇','■','□','●','○','╱','╲','╳',
])
const RAIL_RE = /^[\s]*[\-=~_]{10,}[\s]*$/m
const TREE_LINE_RE = /^[\s│]*(?:├──|└──|├─|└─)/

export interface AsciiArtAnalysis {
  isAsciiArt: boolean
  reason: string
  boxCharCount: number
  treeLineCount: number
  railCount: number
  lineCount: number
}

export function analyzeAsciiArt(code: string): AsciiArtAnalysis {
  const lines = code.split('\n')
  const lineCount = lines.length
  if (lineCount < 2) {
    return { isAsciiArt: false, reason: 'too short', boxCharCount: 0, treeLineCount: 0, railCount: 0, lineCount }
  }

  let boxChars = 0
  for (const c of code) if (BOX_CHARS.has(c)) boxChars += 1

  let treeLines = 0
  for (const line of lines) if (TREE_LINE_RE.test(line)) treeLines += 1

  const rails = (code.match(/^[\s]*[\-=~_]{10,}[\s]*$/gm) ?? []).length

  // Confidence threshold: at least one structural cue
  const hasArt = boxChars >= 4 || treeLines >= 3 || rails >= 2

  if (!hasArt) {
    return {
      isAsciiArt: false, reason: 'no structural cues',
      boxCharCount: boxChars, treeLineCount: treeLines, railCount: rails, lineCount,
    }
  }

  // Negative test: the FixCodeLanguage detector has high-confidence on this?
  // If yes, this is real code that happens to use box chars (e.g., a comment
  // diagram in a real C++ file). Stay out.
  const langDetect = detectLanguage(code)
  if (langDetect.confidence === 'high' && langDetect.lang !== 'text') {
    return {
      isAsciiArt: false, reason: `looks like ${langDetect.lang}`,
      boxCharCount: boxChars, treeLineCount: treeLines, railCount: rails, lineCount,
    }
  }

  let reason = ''
  if (boxChars >= 4) reason = `${boxChars} box chars`
  else if (treeLines >= 3) reason = `${treeLines} tree lines`
  else reason = `${rails} horizontal rules`

  return {
    isAsciiArt: true, reason,
    boxCharCount: boxChars, treeLineCount: treeLines, railCount: rails, lineCount,
  }
}

// ─── SVG generation ─────────────────────────────────────────────────

const CHAR_W = 7.2   // average monospace char advance (px) at 12px size
const LINE_H = 16    // line-height (px)
const PAD = 12

/** Escape a string for safe inclusion as an SVG text node. */
function svgEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Generate an SVG that renders the ASCII art as a monospaced grid. */
export function asciiArtToSvg(code: string): string {
  const lines = code.split('\n')
  const maxLen = Math.max(...lines.map(l => l.length))
  const width = Math.ceil(maxLen * CHAR_W) + PAD * 2
  const height = lines.length * LINE_H + PAD * 2

  const textNodes = lines.map((line, idx) => {
    const y = PAD + (idx + 1) * LINE_H - 4
    return `  <text x="${PAD}" y="${y}" xml:space="preserve">${svgEscape(line)}</text>`
  }).join('\n')

  // Self-contained SVG: monospace font, neutral palette, light border.
  // Brand-token-aware: uses CSS vars when in browser, falls back to neutrals.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="ASCII art diagram">
  <style>
    .ascii-frame { fill: var(--surface-elevated, #f8f7f3); stroke: var(--ruled-line-color, rgba(120,120,120,0.18)); stroke-width: 1; rx: 4; ry: 4; }
    .ascii-line  { font-family: var(--font-mono, "JetBrains Mono", "Menlo", monospace); font-size: 12px; fill: var(--ink-primary, #1a1614); white-space: pre; }
  </style>
  <rect class="ascii-frame" x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" />
  <g class="ascii-line">
${textNodes}
  </g>
</svg>`
}

// ─── Concept harvesting (very conservative) ─────────────────────────

/** Extract concept-shaped tokens from ASCII art body — words that look
 *  like CamelCase identifiers, all-caps acronyms, or backticked terms. */
function harvestConcepts(code: string): string[] {
  const out = new Set<string>()
  const tokens = code.match(/`[A-Za-z][A-Za-z0-9_-]+`|\b[A-Z][A-Za-z]+(?:[A-Z][a-z]+)+\b|\b[A-Z]{3,}\b/g) ?? []
  for (const t of tokens) {
    const slug = t.replace(/`/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    if (slug.length >= 3 && slug.length <= 40) out.add(slug)
  }
  return [...out].slice(0, 8)
}

// ─── Synthesize a caption ───────────────────────────────────────────

/** Extract a caption from the most recent prose block before the ASCII
 *  art (its de-facto introducer) or fall back to a stock line. */
function synthesizeCaption(siblings: readonly Block[], targetIdx: number): string {
  // Look back up to 3 blocks for a heading/text/callout
  for (let i = targetIdx - 1; i >= Math.max(0, targetIdx - 3); i--) {
    const b = siblings[i]
    if (!b) continue
    if (b.type === 'heading') {
      const t = typeof b.text === 'string' ? b.text : ''
      if (t.length > 0 && t.length <= 80) return t
    }
  }
  return 'Diagram'
}

// ─── The pass ───────────────────────────────────────────────────────

export const AsciiArtToFigurePass: BlockPass = {
  name: 'AsciiArtToFigure',
  describe: 'Promote ASCII-art code blocks to typed custom-svg diagram blocks.',
  run(b: Block, ctx: BlockPassContext) {
    if (b.type !== 'code') return { block: b, changed: false }

    const lang = (b.language ?? '').toLowerCase()
    // Only consider code blocks marked text/blank — if the author already
    // tagged a real language, respect it (might be code with comment art).
    if (lang !== '' && lang !== 'text' && lang !== 'txt') return { block: b, changed: false }

    const analysis = analyzeAsciiArt(b.code ?? '')
    if (!analysis.isAsciiArt) return { block: b, changed: false }

    const idxInSiblings = ctx.siblings.findIndex(s => s.id === b.id)
    const caption = synthesizeCaption(ctx.siblings, idxInSiblings)
    const concepts = harvestConcepts(b.code ?? '')
    const svg = asciiArtToSvg(b.code ?? '')

    const promoted: DiagramBlock = {
      id: b.id,
      type: 'diagram',
      status: b.status,
      caption,
      primaryInsight: caption.length > 3 ? caption : undefined,
      category: 'sketchnote',
      style: 'sketchnote',
      aspect: '16:9',
      sourceConcepts: concepts,
      width: 'medium',
      printExport: 'pdf-vector',
      spec: {
        engine: 'custom-svg',
        svg,
        illustrates: concepts,
      },
      quality: {
        lastAuditedAt: new Date().toISOString(),
      },
    }

    return {
      block: promoted as unknown as Block,
      changed: true,
      notes: [{
        severity: 'info',
        code: 'ASCII_PROMOTED',
        msg: `Promoted ASCII art (${analysis.reason}) to custom-svg diagram.`,
        blockId: b.id,
      }],
    }
  },
}
