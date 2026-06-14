#!/usr/bin/env tsx
/* ─── Fix Invalid Chapters ───────────────────────────────────────────────────
   One-shot, data-preserving migration for the 7 live chapters that fail the
   STRICT chapter schema (server/validator.ts). The Write Gate enforces strict
   validation on the WRITE path, so these 7 must be made schema-clean BEFORE
   enforcement is flipped — otherwise any future edit to them would be refused.

   Every remap below is deterministic and verified against the live data. The
   guiding rule: NEVER overwrite real content — only rename misnamed keys
   (value preserved), wrap a value in the shape the schema expects, or add an
   id/field ONLY where it is genuinely MISSING.

   Defects handled (all confirmed against /content):
     1. callout.variant  "info" → "note", "checklist" → "tip"
     2. divider.style     "simple" → "line"
     3. list.style        "bullet" → "unordered"; string items → { text }
     4. toggle.content    string → [ { id, type:'text', text:<string> } ]
     5. quiz.questions[]  key "correct" → "correctIndex" (number preserved);
                          add "id" ONLY where missing
     6. code.annotations  [ {line,text} ] → Record<string,string> keyed by line

   Usage:
     npx tsx scripts/atheneum/fix-invalid-chapters.ts            # dry-run (default)
     npx tsx scripts/atheneum/fix-invalid-chapters.ts --dry-run  # explicit dry-run
     npx tsx scripts/atheneum/fix-invalid-chapters.ts --apply    # write the fixes
     npx tsx scripts/atheneum/fix-invalid-chapters.ts --content-dir <abs-path>

   Default --content-dir is the worktree's own ./content. Point it at the live
   tree only when you intend to apply, eyes-on.

   In --apply mode each fixed chapter is re-validated STRICT in memory and the
   write is aborted if it still fails — the gate's own contract, enforced here
   too. Dry-run never touches disk; it prints exactly what WOULD change.
───────────────────────────────────────────────────────────────────────────── */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { validateChapter } from '../../server/validator.js'

// ─── Block id generator (mirrors mcp/src/lib/block-utils.ts) ───────────────
function generateBlockId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = randomBytes(5)
  let id = 'blk_'
  for (let i = 0; i < 5; i++) id += chars[bytes[i] % chars.length]
  return id
}

// ─── CLI ───────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const DRY_RUN = !APPLY // dry-run is the default; --dry-run is accepted but redundant

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')
const cdIdx = args.indexOf('--content-dir')
const CONTENT_DIR = cdIdx !== -1 && args[cdIdx + 1]
  ? path.resolve(args[cdIdx + 1])
  : path.join(ROOT, 'content')

// ─── The 7 dirty chapters (relative to CONTENT_DIR) ─────────────────────────
const TARGETS = [
  'building-atheneum/chapters/05-mcp-infrastructure.json',
  'silicon-data-stack/chapters/04-chip-design-flow.json',
  'silicon-data-stack/chapters/07-fab-equipment-data.json',
  'silicon-data-stack/chapters/12-reliability-quality.json',
  'silicon-data-stack/chapters/13-data-fragmentation.json',
  'split-ordered-lists/chapters/12-optimizations.json',
  'split-ordered-lists/chapters/16-benchmarking.json',
]

const CALLOUT_VARIANT_REMAP: Record<string, string> = { info: 'note', checklist: 'tip' }
const DIVIDER_STYLE_REMAP: Record<string, string> = { simple: 'line' }
const VALID_CALLOUT = new Set(['tip', 'warning', 'key-concept', 'example', 'definition', 'note'])
const VALID_DIVIDER = new Set(['line', 'dots', 'wave', 'flourish'])

interface Change {
  block: string // "blocks[N] id type"
  detail: string
}

/**
 * Mutate one block in place if it matches a known defect. Push human-readable
 * change lines onto `changes`. Returns nothing — the chapter object is mutated.
 */
function fixBlock(block: any, index: number, changes: Change[]): void {
  const where = `blocks[${index}] id=${block?.id ?? '?'} type=${block?.type ?? '?'}`
  const note = (detail: string) => changes.push({ block: where, detail })

  switch (block?.type) {
    case 'callout': {
      const v = block.variant
      if (typeof v === 'string' && !VALID_CALLOUT.has(v) && CALLOUT_VARIANT_REMAP[v]) {
        const to = CALLOUT_VARIANT_REMAP[v]
        note(`callout.variant "${v}" → "${to}"`)
        block.variant = to
      }
      break
    }

    case 'divider': {
      const s = block.style
      if (typeof s === 'string' && !VALID_DIVIDER.has(s) && DIVIDER_STYLE_REMAP[s]) {
        const to = DIVIDER_STYLE_REMAP[s]
        note(`divider.style "${s}" → "${to}"`)
        block.style = to
      }
      break
    }

    case 'list': {
      if (block.style === 'bullet') {
        note(`list.style "bullet" → "unordered"`)
        block.style = 'unordered'
      }
      if (Array.isArray(block.items)) {
        const stringItems = block.items.filter((it: any) => typeof it === 'string').length
        if (stringItems > 0) {
          note(`list.items: ${stringItems} string item(s) → { text } object(s)`)
          block.items = block.items.map((it: any) =>
            typeof it === 'string' ? { text: it } : it,
          )
        }
      }
      break
    }

    case 'toggle': {
      if (typeof block.content === 'string') {
        const text = block.content
        note(`toggle.content: string (${text.length} chars) → [ { type:"text", text } ]`)
        block.content = [
          { id: generateBlockId(), type: 'text', text },
        ]
      }
      break
    }

    case 'code': {
      if (Array.isArray(block.annotations)) {
        const rec: Record<string, string> = {}
        let mapped = 0
        for (const a of block.annotations) {
          if (a && a.line != null && typeof a.text === 'string') {
            rec[String(a.line)] = a.text
            mapped++
          }
        }
        note(`code.annotations: array[${block.annotations.length}] → Record<string,string> (${mapped} keyed by line)`)
        block.annotations = rec
      }
      break
    }

    case 'quiz': {
      if (Array.isArray(block.questions)) {
        let renamed = 0
        let addedIds = 0
        block.questions.forEach((q: any, qi: number) => {
          // Rename "correct" → "correctIndex", PRESERVING the existing number.
          if (q.correctIndex === undefined && typeof q.correct === 'number') {
            q.correctIndex = q.correct
            delete q.correct
            renamed++
          }
          // Add a stable id ONLY where missing — never overwrite a real one.
          if (q.id === undefined || q.id === null || q.id === '') {
            q.id = `${block.id}_q${qi}`
            addedIds++
          }
        })
        if (renamed > 0 || addedIds > 0) {
          note(`quiz.questions: renamed "correct"→"correctIndex" on ${renamed}, added missing id on ${addedIds} (of ${block.questions.length})`)
        }
      }
      break
    }
  }
}

function fixChapter(chapter: any): Change[] {
  const changes: Change[] = []
  if (Array.isArray(chapter?.blocks)) {
    chapter.blocks.forEach((b: any, i: number) => fixBlock(b, i, changes))
  }
  return changes
}

// ─── Drive ──────────────────────────────────────────────────────────────────
function main() {
  console.log(`fix-invalid-chapters — mode: ${APPLY ? 'APPLY (writing)' : 'DRY-RUN (no writes)'}`)
  console.log(`content dir: ${CONTENT_DIR}\n`)

  let totalChanges = 0
  let filesTouched = 0
  let failedAfterFix = 0
  const missing: string[] = []

  for (const rel of TARGETS) {
    const abs = path.join(CONTENT_DIR, rel)
    if (!existsSync(abs)) {
      missing.push(rel)
      console.log(`SKIP  ${rel} — not found under content dir`)
      continue
    }

    const chapter = JSON.parse(readFileSync(abs, 'utf-8'))

    const before = validateChapter(chapter)
    const changes = fixChapter(chapter)
    const after = validateChapter(chapter)

    console.log(`── ${rel}`)
    console.log(`   strict before: ${before.success ? 'PASS' : `FAIL (${before.errors?.length} issue(s))`}`)
    if (changes.length === 0) {
      console.log(`   no changes\n`)
      continue
    }
    for (const ch of changes) console.log(`   • ${ch.block}: ${ch.detail}`)
    console.log(`   strict after:  ${after.success ? 'PASS' : `STILL FAIL (${after.errors?.length} issue(s))`}`)

    if (!after.success) {
      failedAfterFix++
      console.log(`   ⚠ residual: ${(after.errors ?? []).slice(0, 8).join('; ')}`)
    }

    totalChanges += changes.length
    filesTouched++

    if (APPLY) {
      if (!after.success) {
        console.log(`   ✗ ABORTED write — chapter still fails strict validation after fix.\n`)
        continue
      }
      writeFileSync(abs, JSON.stringify(chapter, null, 2) + '\n', 'utf-8')
      console.log(`   ✓ written\n`)
    } else {
      console.log(`   (dry-run — not written)\n`)
    }
  }

  console.log('──────────────────────────────────────────')
  console.log(`chapters with changes: ${filesTouched}`)
  console.log(`total block-level changes: ${totalChanges}`)
  if (missing.length) console.log(`not found: ${missing.join(', ')}`)
  if (failedAfterFix) {
    console.log(`⚠ ${failedAfterFix} chapter(s) still fail strict after fix — inspect before applying`)
    process.exitCode = 1
  } else {
    console.log(`all targeted chapters pass strict after fix`)
  }
  if (!APPLY) console.log(`\nDRY-RUN complete. Re-run with --apply (eyes-on) to write.`)
}

main()
