/* ─── Chapter-level Lint ─────────────────────────────────────────────────────
   Per-chapter structural + pedagogy checks. Iterates blocks, dispatches each
   to block.ts, then layers chapter-level invariants on top:

     - block-count consistency (`blockCount` vs `blocks.length`)
     - reading-time math (estimatedReadMinutes vs computed words/250wpm; ±50%)
     - heading discipline:
         · exactly 1 H1 (the chapter title)
         · no level skips (H2 → H4 without H3)
         · H1 should match `chapter.title` (stylistic, info-only)
     - first non-meta block should be heading-level-1 (or quote/figure as
       intentional hero — info-only)
     - concept reference harvest (returned for book-level resolution)
───────────────────────────────────────────────────────────────────────────── */

import type { Chapter } from '../../src/types/book.ts'
import type { Block } from '../../src/types/blocks.ts'
import type { ChapterLintResult, LocatedIssue, LintLocation } from './types.ts'
import { lintBlock, wordCount, extractConceptRefs } from './block.ts'

/** Words-per-minute target for reading-time math. */
const WPM = 250
/** Tolerance band for computed vs declared reading time (±50%). */
const READTIME_TOLERANCE = 0.5

interface ChapterLintInput {
  bookId: string
  chapter: Chapter
}

export interface ChapterLintOutput extends ChapterLintResult {
  /** All concept-slugs referenced via `[[slug]]` in this chapter's prose,
   *  for book-level resolution (definedIn / referencedIn / orphans). */
  conceptRefs: string[]
}

export function lintChapter(input: ChapterLintInput): ChapterLintOutput {
  const { bookId, chapter } = input
  const issues: LocatedIssue[] = []
  const baseLoc: LintLocation = { bookId, chapterId: chapter.id }
  const at = (i: Omit<LocatedIssue, 'loc'>): LocatedIssue => ({ ...i, loc: { ...baseLoc } })

  const blocks: Block[] = chapter.blocks ?? []

  // ─ 1. Frontmatter shape ────────────────────────────────────────────
  if (!chapter.id) {
    issues.push(at({ severity: 'error', code: 'CHAP_NO_ID', msg: 'Chapter is missing id.' }))
  }
  if (!chapter.title || chapter.title.trim().length === 0) {
    issues.push(at({ severity: 'error', code: 'CHAP_NO_TITLE', msg: 'Chapter is missing title.' }))
  }
  if (typeof chapter.number !== 'number') {
    issues.push(at({ severity: 'warn', code: 'CHAP_NO_NUMBER', msg: 'Chapter is missing a numeric ordering.' }))
  }
  if (blocks.length === 0) {
    issues.push(at({ severity: 'error', code: 'CHAP_EMPTY', msg: 'Chapter has zero blocks.' }))
  }

  // ─ 2. blockCount consistency ──────────────────────────────────────
  if (typeof chapter.blockCount === 'number' && chapter.blockCount !== blocks.length) {
    issues.push(at({
      severity: 'info',
      code: 'CHAP_BLOCKCOUNT_MISMATCH',
      msg: `Declared blockCount=${chapter.blockCount}, actual=${blocks.length}. Re-run the build.`,
    }))
  }

  // ─ 3. Reading-time math ───────────────────────────────────────────
  let totalWords = 0
  let diagramCount = 0
  let codeBlocks = 0
  for (const b of blocks) {
    if (b.type === 'text' || b.type === 'callout') totalWords += wordCount(b.text)
    if (b.type === 'heading') totalWords += wordCount(b.text)
    if (b.type === 'quote') totalWords += wordCount(b.text)
    if (b.type === 'summary') totalWords += b.points.reduce((acc, p) => acc + wordCount(p), 0)
    if (b.type === 'list') {
      const walk = (items: typeof b.items): number =>
        items.reduce((acc, it) => acc + wordCount(it.text) + (it.children ? walk(it.children) : 0), 0)
      totalWords += walk(b.items)
    }
    if (b.type === 'diagram') diagramCount += 1
    if (b.type === 'code') codeBlocks += 1
  }
  const computedMinutes = Math.max(1, Math.round(totalWords / WPM))
  if (typeof chapter.estimatedReadMinutes === 'number') {
    const declared = chapter.estimatedReadMinutes
    const lo = Math.floor(computedMinutes * (1 - READTIME_TOLERANCE))
    const hi = Math.ceil(computedMinutes * (1 + READTIME_TOLERANCE))
    if (declared < lo || declared > hi) {
      issues.push(at({
        severity: 'info',
        code: 'CHAP_READTIME_OFF',
        msg: `Declared reading time ${declared}min is outside ±50% band of computed ${computedMinutes}min (${totalWords} words at ${WPM}wpm).`,
      }))
    }
  }

  // ─ 4. Heading discipline ──────────────────────────────────────────
  let h1Count = 0
  let lastLevel = 0
  let firstH1Text = ''
  for (const b of blocks) {
    if (b.type !== 'heading') continue
    if (b.level === 1) {
      h1Count += 1
      if (firstH1Text === '') firstH1Text = typeof b.text === 'string' ? b.text : ''
    }
    if (lastLevel > 0 && b.level > lastLevel + 1) {
      issues.push({
        ...at({
          severity: 'warn',
          code: 'CHAP_HEADING_SKIP',
          msg: `Heading level skipped: H${lastLevel} → H${b.level}.`,
          hint: 'Use sequential heading levels for accessibility + outline parsing.',
        }),
        loc: { ...baseLoc, blockId: b.id },
      })
    }
    lastLevel = b.level
  }
  if (h1Count === 0) {
    issues.push(at({
      severity: 'warn',
      code: 'CHAP_NO_H1',
      msg: 'Chapter has no H1 heading.',
      hint: 'Every chapter should open with an H1 matching its title.',
    }))
  } else if (h1Count > 1) {
    issues.push(at({
      severity: 'warn',
      code: 'CHAP_MULTIPLE_H1',
      msg: `Chapter has ${h1Count} H1 headings; only one allowed.`,
    }))
  }
  if (firstH1Text && chapter.title && firstH1Text.trim() !== chapter.title.trim()) {
    issues.push(at({
      severity: 'info',
      code: 'CHAP_H1_TITLE_MISMATCH',
      msg: `H1 ("${firstH1Text.slice(0, 40)}...") differs from chapter.title ("${chapter.title.slice(0, 40)}...").`,
    }))
  }

  // ─ 5. Empty chapters / no diagrams / wall-of-text checks ──────────
  if (blocks.length > 30 && diagramCount === 0 && codeBlocks === 0) {
    issues.push(at({
      severity: 'info',
      code: 'CHAP_NO_VISUAL',
      msg: `Chapter has ${blocks.length} blocks but no diagrams or code — risk of wall-of-text.`,
      hint: 'Cookbook: every chapter benefits from at least one structural diagram.',
    }))
  }

  // ─ 6. Per-block lint ──────────────────────────────────────────────
  const conceptRefs: string[] = []
  for (const b of blocks) {
    issues.push(...lintBlock(b, baseLoc))
    // harvest concept refs from prose-shaped blocks
    if (b.type === 'text' || b.type === 'callout' || b.type === 'quote') {
      conceptRefs.push(...extractConceptRefs(b.text))
    }
    if (b.type === 'list') {
      const walk = (items: typeof b.items): void => {
        for (const it of items) {
          conceptRefs.push(...extractConceptRefs(it.text))
          if (it.children) walk(it.children)
        }
      }
      walk(b.items)
    }
    if (b.type === 'summary') {
      for (const p of b.points) conceptRefs.push(...extractConceptRefs(p))
    }
  }

  // ─ Score: 100 minus penalties ────────────────────────────────────
  let score = 100
  let errors = 0
  for (const i of issues) {
    if (i.severity === 'error') { score -= 8; errors += 1 }
    else if (i.severity === 'warn') { score -= 2 }
    // info doesn't dock
  }
  if (score < 0) score = 0

  return {
    bookId,
    chapterId: chapter.id,
    title: chapter.title,
    blockCount: blocks.length,
    diagramCount,
    issues,
    score,
    errors,
    conceptRefs: [...new Set(conceptRefs)],
  }
}
