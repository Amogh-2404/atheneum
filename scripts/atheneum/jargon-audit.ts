#!/usr/bin/env tsx
/* ─── Jargon Audit ───────────────────────────────────────────────────────────
   For each .md chapter in the Athenaeum source, surface:
     - count of distinct technical terms (acronyms 2-6 caps, CamelCase ids,
       hump-shaped tokens like mem2reg / SelectionDAG / GlobalISel)
     - whether the chapter has a "Concepts at a glance" or "Glossary" box
     - count of inline cross-refs (markdown links to ../something.md OR
       phrases matching `→ §X.YY`)
     - count of `## See also` entries (the existing pointer pattern)
     - heuristic info-dump score: distinct_terms / max(1, cross_refs)

   Also: per-chapter top 10 most-frequent UNINTRODUCED acronyms (acronyms
   that appear in the chapter but lack any nearby "X is/means/stands for"
   shape AND aren't in any glossary table).

   Usage:
     npx tsx scripts/atheneum/jargon-audit.ts <srcDir>

   Output:
     build/jargon-audit.json        machine-readable per-chapter
     build/jargon-audit.md          human-readable, sorted by info-dump score
───────────────────────────────────────────────────────────────────────────── */

import { promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')
const BUILD_DIR = path.join(ROOT, 'build')

// ─── Term detection ────────────────────────────────────────────────

/** All-caps acronym 2-6 chars (e.g., LLVM, MLIR, GVN, SCCP, BDCE, DSE). */
const ACRO_RE = /\b[A-Z]{2,6}\d?\b/g
/** "humpy" identifier: lowercase mixed with digits/uppercase, not pure word
 *  (e.g., mem2reg, SelectionDAG, JumpThreading, IndVarSimplify). */
const HUMP_RE = /\b[a-zA-Z]+(?:\d+[A-Za-z]*|[A-Z][a-z]+){2,}\b|\b[a-z]+\d[a-z]+\b/g
/** TitleCase compound: SelectionDAG, GlobalISel, FastISel, MachineScheduler. */
const TITLECASE_RE = /\b(?:[A-Z][a-z]+){2,}[A-Z]?[a-z]*\b/g

/** Words we don't count — they're general English or already too common. */
const STOP_WORDS = new Set([
  'AT','TO','OR','OF','BE','IS','IT','IN','ON','AS','BY','AN','SO','NO','IF','OK',
  'I','A','TLDR','TLDR','TODO','HTTP','URL','API','CPU','GPU','OS','UI',
  'PR','PRs','TU','TUs','C','CPP',
])

/** Definition-shaped patterns within ~120 chars of a term mention. */
function hasDefinitionShape(text: string, term: string): boolean {
  const escTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`\\*\\*${escTerm}\\*\\*\\s*[—:–-]`, 'i'),    // **TERM** — ...
    new RegExp(`\\*\\*${escTerm}\\*\\*\\s*\\(`, 'i'),         // **TERM** (...
    new RegExp(`${escTerm}\\s*\\(([A-Z][^)]+)\\)`, 'i'),       // TERM (Full Name)
    new RegExp(`${escTerm}\\s+(stands for|means|is short for|=)`, 'i'),
    new RegExp(`\\| \\*\\*${escTerm}\\*\\* \\|`),              // glossary table row
  ]
  return patterns.some(p => p.test(text))
}

interface ChapterAudit {
  filePath: string
  section: string
  filename: string
  lines: number
  bytes: number
  hasGlossaryBox: boolean
  crossRefCount: number     // markdown links to ../*.md + "→ §..." patterns
  seeAlsoCount: number
  uniqueTerms: number
  unintroducedTerms: Array<{ term: string; mentions: number }>
  infoDumpScore: number
}

function findTerms(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  const matchAndCount = (re: RegExp) => {
    const matches = text.match(re) ?? []
    for (const m of matches) {
      if (STOP_WORDS.has(m)) continue
      if (m.length < 2) continue
      counts.set(m, (counts.get(m) ?? 0) + 1)
    }
  }
  matchAndCount(ACRO_RE)
  matchAndCount(HUMP_RE)
  matchAndCount(TITLECASE_RE)
  return counts
}

function auditChapter(filePath: string, text: string): ChapterAudit {
  const lines = text.split('\n').length
  const bytes = Buffer.byteLength(text, 'utf-8')
  const filename = path.basename(filePath)
  const section = path.basename(path.dirname(filePath))

  const hasGlossaryBox = /^##\s+(Concepts at a glance|Glossary|Key terms|Cheat sheet)\b/im.test(text)

  // Cross-refs: markdown links to other .md files + "→ §X.Y" inline
  const mdLinks = (text.match(/\[[^\]]+\]\([^)]+\.md[^)]*\)/g) ?? []).length
  const arrowRefs = (text.match(/→\s*§\s*\d+\.\d+/g) ?? []).length
  const crossRefCount = mdLinks + arrowRefs

  // "## See also" arrow-list entries
  const seeAlsoBlock = text.match(/##\s+See\s+also[\s\S]*?(?=\n##\s|\n$)/i)?.[0] ?? ''
  const seeAlsoCount = (seeAlsoBlock.match(/^[\-\*]\s*→/gm) ?? []).length +
                       (seeAlsoBlock.match(/^[\-\*]\s*`/gm) ?? []).length

  // Find all candidate terms in body, then filter to ones without nearby def
  const counts = findTerms(text)
  const unintroduced: Array<{ term: string; mentions: number }> = []
  for (const [term, mentions] of counts) {
    if (mentions < 2) continue              // ignore one-off mentions
    if (hasDefinitionShape(text, term)) continue
    unintroduced.push({ term, mentions })
  }
  unintroduced.sort((a, b) => b.mentions - a.mentions)

  const infoDumpScore = unintroduced.length / Math.max(1, crossRefCount)

  return {
    filePath, section, filename, lines, bytes,
    hasGlossaryBox,
    crossRefCount, seeAlsoCount,
    uniqueTerms: counts.size,
    unintroducedTerms: unintroduced.slice(0, 12),
    infoDumpScore: Math.round(infoDumpScore * 10) / 10,
  }
}

async function main() {
  const srcRoot = process.argv[2]
  if (!srcRoot) {
    console.error('usage: jargon-audit.ts <srcDir>')
    process.exit(1)
  }
  const sections = (await fs.readdir(srcRoot, { withFileTypes: true }))
    .filter(e => e.isDirectory() && /^\d/.test(e.name))
    .map(e => e.name)
    .sort()

  const audits: ChapterAudit[] = []
  for (const sec of sections) {
    const secDir = path.join(srcRoot, sec)
    const files = (await fs.readdir(secDir, { withFileTypes: true }))
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => e.name)
      .sort()
    for (const f of files) {
      const fp = path.join(secDir, f)
      const stat = await fs.stat(fp)
      if (stat.size < 500) continue
      const text = await fs.readFile(fp, 'utf-8')
      audits.push(auditChapter(fp, text))
    }
  }

  await fs.mkdir(BUILD_DIR, { recursive: true })
  await fs.writeFile(path.join(BUILD_DIR, 'jargon-audit.json'), JSON.stringify(audits, null, 2))

  // ─ Markdown summary ─
  const md: string[] = []
  md.push('# Atheneum Jargon Audit')
  md.push('')
  md.push(`Total chapters: ${audits.length}`)
  md.push(`Have glossary box: ${audits.filter(a => a.hasGlossaryBox).length}`)
  md.push(`Avg cross-refs/chapter: ${(audits.reduce((a, c) => a + c.crossRefCount, 0) / audits.length).toFixed(1)}`)
  md.push(`Avg unintroduced terms/chapter: ${(audits.reduce((a, c) => a + c.unintroducedTerms.length, 0) / audits.length).toFixed(1)}`)
  md.push('')
  md.push('## Worst offenders by info-dump score (unintroduced terms ÷ cross-refs)')
  md.push('')
  md.push('| Chapter | Section | Lines | Cross-refs | Unintro terms | Score | Glossary? |')
  md.push('|---|---|---:|---:|---:|---:|:---:|')
  const worst = [...audits].sort((a, b) => b.infoDumpScore - a.infoDumpScore).slice(0, 25)
  for (const a of worst) {
    md.push(`| \`${a.filename}\` | ${a.section} | ${a.lines} | ${a.crossRefCount} | ${a.unintroducedTerms.length} | **${a.infoDumpScore}** | ${a.hasGlossaryBox ? '✓' : '—'} |`)
  }
  md.push('')
  md.push('## Top-10 unintroduced terms across the whole corpus')
  md.push('')
  const corpusCounter = new Map<string, number>()
  for (const a of audits) {
    for (const t of a.unintroducedTerms) {
      corpusCounter.set(t.term, (corpusCounter.get(t.term) ?? 0) + t.mentions)
    }
  }
  const corpusTop = [...corpusCounter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
  md.push('| Term | Total mentions w/o nearby def |')
  md.push('|---|---:|')
  for (const [term, n] of corpusTop) md.push(`| \`${term}\` | ${n} |`)
  md.push('')
  md.push('## Per-section roll-up')
  md.push('')
  const sectionRoll = new Map<string, { ch: number; gloss: number; refs: number; unintro: number }>()
  for (const a of audits) {
    const cur = sectionRoll.get(a.section) ?? { ch: 0, gloss: 0, refs: 0, unintro: 0 }
    cur.ch += 1
    if (a.hasGlossaryBox) cur.gloss += 1
    cur.refs += a.crossRefCount
    cur.unintro += a.unintroducedTerms.length
    sectionRoll.set(a.section, cur)
  }
  md.push('| Section | Chapters | With glossary | Total refs | Total unintro |')
  md.push('|---|---:|---:|---:|---:|')
  for (const [sec, s] of [...sectionRoll].sort()) {
    md.push(`| ${sec} | ${s.ch} | ${s.gloss} | ${s.refs} | ${s.unintro} |`)
  }
  md.push('')
  await fs.writeFile(path.join(BUILD_DIR, 'jargon-audit.md'), md.join('\n'))

  console.log('▸ jargon audit')
  console.log(`  chapters: ${audits.length}`)
  console.log(`  with glossary: ${audits.filter(a => a.hasGlossaryBox).length}`)
  console.log(`  avg cross-refs:    ${(audits.reduce((a, c) => a + c.crossRefCount, 0) / audits.length).toFixed(1)}`)
  console.log(`  avg unintro/chap:  ${(audits.reduce((a, c) => a + c.unintroducedTerms.length, 0) / audits.length).toFixed(1)}`)
  console.log('')
  console.log('  Top 10 worst chapters by info-dump score:')
  for (const a of worst.slice(0, 10)) {
    console.log(`    ${a.section}/${a.filename.padEnd(40)} score=${String(a.infoDumpScore).padStart(5)}  unintro=${String(a.unintroducedTerms.length).padStart(2)}  refs=${String(a.crossRefCount).padStart(2)}  ${a.hasGlossaryBox ? '✓gloss' : ''}`)
  }
  console.log('')
  console.log(`  Wrote: build/jargon-audit.json + .md`)
}

main().catch(e => {
  console.error('audit failed:', e)
  process.exit(1)
})
