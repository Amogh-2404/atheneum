/* ─── Atheneum Lint Types ────────────────────────────────────────────────────
   Shared types for every lint pass (diagram, block, chapter, book).
   Pure types — no runtime deps. Imports OK from src/types/diagrams.ts only
   (which itself imports zod for schema use).
───────────────────────────────────────────────────────────────────────────── */

import type { LintIssue } from '../../src/types/diagrams.ts'
export type { LintIssue } from '../../src/types/diagrams.ts'

/** Where in the corpus a lint issue lives. Used to surface "go fix this here". */
export interface LintLocation {
  bookId?: string
  chapterId?: string
  blockId?: string
  /** Optional finer-grained pointer (e.g. "questions[2].correctIndex"). */
  path?: string
}

/** A located lint issue — same shape as `LintIssue`, plus the location. */
export interface LocatedIssue extends LintIssue {
  loc: LintLocation
}

/** One chapter's lint result. */
export interface ChapterLintResult {
  bookId: string
  chapterId: string
  title: string
  blockCount: number
  diagramCount: number
  issues: LocatedIssue[]
  /** 0-100 — capped at 0 if errors > 0, otherwise 100 - 4×warns. */
  score: number
  errors: number
}

/** One book's lint result, aggregating its chapters. */
export interface BookLintResult {
  bookId: string
  title: string
  chapterCount: number
  diagramCount: number
  totalBlocks: number
  /** Issues that pertain to the book itself (orphans, missing index, etc.). */
  bookLevelIssues: LocatedIssue[]
  chapters: ChapterLintResult[]
  /** Average chapter score across the book. */
  avgScore: number
  errors: number
}

/** The whole-corpus lint report. */
export interface AtheneumLintReport {
  generatedAt: string
  totals: {
    books: number
    chapters: number
    blocks: number
    diagrams: number
    issues: number
    errors: number
    avgScore: number
  }
  perBook: BookLintResult[]
  /** Flat list of the top 25 issue codes by count, with one example each. */
  topIssues: Array<{ code: string; count: number; example: string }>
}
