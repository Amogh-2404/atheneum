#!/usr/bin/env node
// ACO tool: insert a derivation block into a chapter, idempotently, at a sensible
// position (right after the chapter's first math block). The nightly editor authors
// the spec JSON and calls this — the MECHANICS are deterministic, not left to the AI.
//
// Usage: node scripts/aco/apply-derivation.mjs <book> <chapter> <spec.json> [--status draft|published]
// spec.json shape: { "title": "...", "lines": [{ "latex", "delta", "note" }], "caption": "..." }
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const [book, chapter, specPath] = process.argv.slice(2)
const status = process.argv.includes('--status') ? process.argv[process.argv.indexOf('--status') + 1] : 'published'
if (!book || !chapter || !specPath) { console.error('usage: apply-derivation <book> <chapter> <spec.json> [--status draft|published]'); process.exit(2) }

const cpath = join(ROOT, 'content', book, 'chapters', `${chapter}.json`)
if (!existsSync(cpath)) { console.error('no such chapter:', cpath); process.exit(2) }
const spec = JSON.parse(readFileSync(specPath, 'utf8'))
if (spec.skip) { console.log('spec is skip — nothing applied'); process.exit(0) }
if (!Array.isArray(spec.lines) || spec.lines.length < 2) { console.error('spec must have >=2 lines'); process.exit(2) }
for (const l of spec.lines) if (typeof l.latex !== 'string' || !l.latex.trim()) { console.error('every line needs latex'); process.exit(2) }

const chap = JSON.parse(readFileSync(cpath, 'utf8'))
const bid = `blk_deriv_aco_${chapter.replace(/-/g, '_').slice(0, 24)}`
const block = { id: bid, type: 'derivation', status, title: spec.title || '', lines: spec.lines, caption: spec.caption || '' }
chap.blocks = (chap.blocks || []).filter((b) => b.id !== bid) // idempotent
const pos = chap.blocks.findIndex((b) => b.type === 'math' || b.type === 'reactive-math')
const idx = pos >= 0 ? pos + 1 : Math.floor(chap.blocks.length * 0.6)
chap.blocks.splice(idx, 0, block)
chap.blockCount = chap.blocks.length
writeFileSync(cpath, JSON.stringify(chap, null, 2) + '\n')
console.log(`applied ${bid} (${block.lines.length} lines, status=${status}) into ${book}/${chapter} at ${idx}`)
