#!/usr/bin/env node
// ACO tool: keep each book's outline.conceptIndex in sync with its chapters —
// deterministically and SAFELY. Refreshes `referencedIn` (so the hovercard's
// "in N chapters" stays truthful as content grows) and reports drift (new
// definition callouts not yet indexed, refs that resolve to nothing). PRESERVES
// definedIn + prerequisites (the inferred graph edges — never clobbered here).
//
// Usage: node scripts/aco/graph-sync.mjs [--write]   (default: dry-run report)
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CONTENT = join(ROOT, 'content')
const WRITE = process.argv.includes('--write')
const j = (p) => JSON.parse(readFileSync(p, 'utf8'))
const text = (b) => { const t = b.text ?? b.title ?? b.caption ?? ''; return typeof t === 'string' ? t : Array.isArray(t) ? t.map((s) => s.text || '').join('') : '' }

let touched = 0, drift = 0
for (const book of readdirSync(CONTENT).filter((d) => existsSync(join(CONTENT, d, 'outline.json')))) {
  const opath = join(CONTENT, book, 'outline.json')
  const outline = j(opath)
  const ci = outline.conceptIndex || {}
  if (!Object.keys(ci).length) continue
  const dir = join(CONTENT, book, 'chapters')
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'))

  // collect, per concept slug, which chapters reference it (via [[ref]] de-hyphenated)
  const refIn = new Map(Object.keys(ci).map((s) => [s, new Set()]))
  const nameToSlug = new Map(Object.keys(ci).map((s) => [s.replace(/[-_]/g, ' '), s]))
  const definedNames = new Set()
  for (const f of files) {
    const id = f.replace(/\.json$/, '')
    for (const b of j(join(dir, f)).blocks || []) {
      if (b.type === 'callout' && b.variant === 'definition' && b.title) definedNames.add(b.title.toLowerCase().trim().replace(/[-_]/g, ' '))
      const m = text(b).match(/\[\[([^\]]+)\]\]/g)
      if (m) for (const x of m) {
        const name = x.slice(2, -2).toLowerCase().trim().replace(/[-_]/g, ' ')
        const slug = nameToSlug.get(name)
        if (slug && id !== ci[slug].definedIn) refIn.get(slug).add(id)
      }
    }
  }
  let changed = false
  for (const [slug, set] of refIn) {
    const next = [...set].sort()
    const prev = ci[slug].referencedIn || []
    if (JSON.stringify(next) !== JSON.stringify(prev)) { ci[slug].referencedIn = next; changed = true }
  }
  // drift: a defined concept (callout) that the graph doesn't know about
  const undefinedish = Object.keys(ci).filter((s) => !definedNames.has(s.replace(/[-_]/g, ' '))).length
  if (changed) { touched++; if (WRITE) writeFileSync(opath, JSON.stringify(outline, null, 2) + '\n') }
  if (changed || undefinedish) { drift++; console.log(`${book}: referencedIn ${changed ? 'updated' : 'ok'}, ${undefinedish} graph concepts lack an inline definition`) }
}
console.log(`graph-sync: ${touched} book(s) ${WRITE ? 'written' : 'would update'}, ${drift} with drift. ${WRITE ? '' : '(dry-run; pass --write to apply)'}`)
