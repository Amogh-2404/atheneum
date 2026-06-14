/* ─── Atheneum Optimizer Pass Framework ──────────────────────────────────────
   Same shape as LLVM passes. A pass is a pure transformation IR → IR:

     interface Pass {
       name: string
       describe: string
       run(input): output
     }

   Composability:
     - All passes are pure (no I/O). Caller orchestrates reads + writes.
     - Passes report what they changed in `output.touchedBlocks` so the runner
       can summarize "FixedCodeLang touched 181 blocks across 28 chapters".
     - Passes never throw on bad input — they emit a `notes[]` entry instead.
     - Passes are level-typed: BlockPass (block → block), ChapterPass
       (chapter → chapter), or BookPass (book → book). Most live at block.

   Order convention:
     1. Schema-fix passes  (FixCodeLang, FixBlockId, FixCaption)
     2. Promotion passes   (AsciiArtToFigure, MarkdownTableToTable)
     3. Extraction passes  (ExtractDrills, ExtractQbank, ExtractSummary)
     4. Annotation passes  (HarvestConcepts, BuildOutline)

   This file: only the shared types. Concrete passes live in server/passes/*.
───────────────────────────────────────────────────────────────────────────── */

import type { Block } from '../../src/types/blocks.ts'
import type { Chapter } from '../../src/types/book.ts'

export interface PassNote {
  /** "info" | "warn" | "error" — same shape as lint issues. */
  severity: 'info' | 'warn' | 'error'
  code: string
  msg: string
  /** Optional pointer to the affected block / chapter. */
  blockId?: string
}

export interface PassRunReport {
  passName: string
  /** Did this pass touch the input? Cheap signal for the runner. */
  changed: boolean
  /** Number of blocks / chapters touched. */
  touched: number
  /** Optional structured notes — what the pass actually did. */
  notes: PassNote[]
}

// ─── BlockPass: per-block transformation ─────────────────────────────

export interface BlockPassContext {
  bookId: string
  chapterId: string
  /** Original surrounding blocks — useful for context (e.g. pseudocode). */
  siblings: readonly Block[]
}

export interface BlockPass {
  name: string
  describe: string
  /** Returns either the (possibly mutated) block, or null to delete it.
   *  Implementations should clone before mutating to keep purity. */
  run(b: Block, ctx: BlockPassContext): {
    block: Block | null
    changed: boolean
    notes?: PassNote[]
  }
}

// ─── ChapterPass: whole-chapter transformation ───────────────────────

export interface ChapterPassContext {
  bookId: string
}

export interface ChapterPass {
  name: string
  describe: string
  run(ch: Chapter, ctx: ChapterPassContext): {
    chapter: Chapter
    changed: boolean
    notes?: PassNote[]
  }
}

// ─── Pass runner result ──────────────────────────────────────────────

export interface PassPipelineResult {
  bookId: string
  chapterId: string
  changed: boolean
  passReports: PassRunReport[]
  /** The chapter post-pipeline. Caller decides whether to write back. */
  chapter: Chapter
}

/** Run a sequence of block passes over every block of a chapter. */
export function runBlockPasses(
  chapter: Chapter,
  passes: readonly BlockPass[],
  ctx: ChapterPassContext,
): PassPipelineResult {
  const passReports: PassRunReport[] = []
  let blocks = chapter.blocks ?? []
  let chapterChanged = false

  for (const pass of passes) {
    let touched = 0
    let changed = false
    const notes: PassNote[] = []
    const next: Block[] = []
    for (const b of blocks) {
      const out = pass.run(b, { bookId: ctx.bookId, chapterId: chapter.id, siblings: blocks })
      if (out.notes) notes.push(...out.notes)
      if (out.changed) { changed = true; touched += 1 }
      if (out.block === null) continue // pass deletes this block
      next.push(out.block)
    }
    if (changed) chapterChanged = true
    blocks = next
    passReports.push({
      passName: pass.name,
      changed,
      touched,
      notes,
    })
  }

  return {
    bookId: ctx.bookId,
    chapterId: chapter.id,
    changed: chapterChanged,
    passReports,
    chapter: { ...chapter, blocks, blockCount: blocks.length },
  }
}
