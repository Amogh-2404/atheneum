#!/usr/bin/env node
// Atheneum Content Operations — the AUDITOR.
// Deterministic, no AI. Walks the whole library and produces a ranked work-list of
// real gaps the nightly editor should close. This is the CI half of "run it like a
// company": the editor never guesses what to do — it's handed a prioritized backlog.
//
// Usage:  node scripts/aco/audit.mjs            # writes .aco/state/audit.json + prints a summary
//         node scripts/aco/audit.mjs --top 5    # print the top N gaps only
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CONTENT = join(ROOT, 'content')
const STATE_DIR = join(ROOT, '.aco', 'state')

const VISUAL_TYPES = new Set(['figure', 'diagram', 'scrolly-figure', 'derivation', 'reactive-math', 'sandbox'])
const MATHY = new Set(['math', 'reactive-math'])
const STEPPY = new Set(['timeline', 'list'])

const j = (p) => JSON.parse(readFileSync(p, 'utf8'))
const blockText = (b) => {
  const t = b.text ?? b.title ?? b.caption ?? ''
  if (typeof t === 'string') return t
  if (Array.isArray(t)) return t.map((s) => s.text || '').join('')
  return ''
}

function books() {
  if (!existsSync(CONTENT)) return []
  return readdirSync(CONTENT).filter((d) => existsSync(join(CONTENT, d, 'chapters')))
}

const gaps = []
function push(type, book, chapter, score, detail) { gaps.push({ type, book, chapter, score, detail }) }

for (const book of books()) {
  const dir = join(CONTENT, book, 'chapters')
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
  const outline = existsSync(join(CONTENT, book, 'outline.json')) ? j(join(CONTENT, book, 'outline.json')) : {}
  const ci = outline.conceptIndex || {}
  const conceptNames = new Set(Object.keys(ci).map((s) => s.replace(/[-_]/g, ' ')))
  const defined = new Set() // de-hyphenated names with a definition callout

  // pass 1: collect defined concepts + per-chapter stats
  const chapters = []
  for (const f of files) {
    const d = j(join(dir, f))
    const blocks = d.blocks || []
    const types = blocks.map((b) => b.type)
    const refs = new Set()
    let mathy = 0, steppy = 0
    for (const b of blocks) {
      if (b.type === 'callout' && b.variant === 'definition' && b.title) defined.add(b.title.toLowerCase().trim().replace(/[-_]/g, ' '))
      if (MATHY.has(b.type)) mathy++
      if (STEPPY.has(b.type)) steppy++
      const m = blockText(b).match(/\[\[([^\]]+)\]\]/g)
      if (m) m.forEach((x) => refs.add(x.slice(2, -2).toLowerCase().trim().replace(/[-_]/g, ' ')))
    }
    chapters.push({ id: f.replace(/\.json$/, ''), blocks: blocks.length, types, refs, mathy, steppy,
      hasVisual: types.some((t) => VISUAL_TYPES.has(t)) })
  }
  const median = chapters.map((c) => c.blocks).sort((a, b) => a - b)[Math.floor(chapters.length / 2)] || 0

  // reference / index chapters never want a cinematic figure — a glossary or a
  // Q&A bank has many list blocks but no process to animate. Don't force it.
  const isReference = (id) => /glossary|appendix|acronym|quick-ref|cheat|question-bank|qs-|q-and-a|index|references|further-reading|resources/i.test(id)

  // pass 2: gaps
  for (const c of chapters) {
    // CINEMATIC GAP — math chapters (a derivation) are the high-confidence, AAA-
    // reliable target; genuine process chapters (a scrolly-figure) score lower and
    // only when they aren't reference material.
    if (!c.hasVisual && !isReference(c.id)) {
      const derivable = c.mathy >= 1
      const process = c.steppy >= 3 // a few real step lists, not one stray bullet
      if (derivable) push('cinematic-gap', book, c.id, 60 + c.mathy * 10, { suggested: 'derivation', mathy: c.mathy })
      else if (process && c.types.includes('table')) push('cinematic-gap', book, c.id, 40 + c.steppy, { suggested: 'scrolly-figure', steppy: c.steppy })
    }
    // BROKEN LINK — a [[ref]] that resolves to neither a definition nor a graph concept.
    for (const r of c.refs) {
      if (!defined.has(r) && !conceptNames.has(r)) push('broken-link', book, c.id, 30, { ref: r })
    }
    // THIN CHAPTER — well under the book's median depth.
    if (median > 0 && c.blocks < Math.max(6, median * 0.45)) push('thin-chapter', book, c.id, 20, { blocks: c.blocks, median })
  }

  // UNDEFINED CONCEPT — a graph node with no inline definition. The hovercard
  // already handles these gracefully ("defined in the map"), so they're a low-
  // priority polish item: emit only a few per book so they never swamp the backlog.
  let und = 0
  for (const [slug, meta] of Object.entries(ci)) {
    if (!defined.has(slug.replace(/[-_]/g, ' ')) && und < 3) { push('undefined-concept', book, meta.definedIn || '', 15, { slug }); und++ }
  }
  // STALE GRAPH — concepts present but the book never got prerequisites inferred.
  if (Object.keys(ci).length && !outline.prerequisitesInferred && !Object.values(ci).some((v) => (v.prerequisites || []).length))
    push('stale-graph', book, '', 35, { concepts: Object.keys(ci).length })
}

gaps.sort((a, b) => b.score - a.score)
const summary = {}
for (const g of gaps) summary[g.type] = (summary[g.type] || 0) + 1

mkdirSync(STATE_DIR, { recursive: true })
const out = { generatedAt: new Date().toISOString(), totals: summary, count: gaps.length, gaps }
writeFileSync(join(STATE_DIR, 'audit.json'), JSON.stringify(out, null, 2))

const topN = process.argv.includes('--top') ? Number(process.argv[process.argv.indexOf('--top') + 1]) || 10 : gaps.length
console.log(`Atheneum audit — ${gaps.length} gaps:`, summary)
for (const g of gaps.slice(0, topN)) {
  console.log(`  [${g.score}] ${g.type}  ${g.book}/${g.chapter}  ${JSON.stringify(g.detail)}`)
}
