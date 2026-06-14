/* ─── Book-level Lint ────────────────────────────────────────────────────────
   Aggregates chapter results, then layers cross-chapter / book-wide checks:

     - book.json shape (title, description, author, status, tags, chapterCount)
     - chapterCount in book.json matches actual chapter file count
     - outline.json present, has all chapters listed in book.json
     - concept resolution: every `[[concept]]` ref in any chapter resolves
       to a concept declared in outline.conceptIndex (or info-level if not)
     - orphan chapters: chapter file exists but not in outline
     - phantom chapters: in outline but no chapter file
     - empty book detection (zero chapters)

   All I/O is in audit.ts (the runner). This file is pure: takes the loaded
   data + chapter results, produces a BookLintResult.
───────────────────────────────────────────────────────────────────────────── */

import type { BookLintResult, LocatedIssue, LintLocation } from './types.ts'
import type { ChapterLintOutput } from './chapter.ts'

interface BookFrontmatter {
  id?: string
  title?: string
  subtitle?: string
  description?: string
  author?: string
  status?: string
  tags?: string[]
  chapterCount?: number
  coverColor?: string
  coverIcon?: string
}

interface BookOutlineLike {
  chapters?: Array<{ id: string; title?: string; concepts?: string[] }>
  conceptIndex?: Record<string, { definedIn: string; referencedIn?: string[]; prerequisites?: string[] }>
}

export interface BookLintInput {
  bookId: string
  book: BookFrontmatter | null
  outline: BookOutlineLike | null
  chapters: ChapterLintOutput[]
  /** Chapter file IDs found on disk (for orphan/phantom detection). */
  diskChapterIds: string[]
}

export function lintBook(input: BookLintInput): BookLintResult {
  const { bookId, book, outline, chapters, diskChapterIds } = input
  const baseLoc: LintLocation = { bookId }
  const at = (i: Omit<LocatedIssue, 'loc'>): LocatedIssue => ({ ...i, loc: { ...baseLoc } })
  const bookLevelIssues: LocatedIssue[] = []

  // ─ 1. book.json shape ──────────────────────────────────────────────
  if (!book) {
    bookLevelIssues.push(at({
      severity: 'error',
      code: 'BOOK_NO_METADATA',
      msg: 'book.json is missing or unreadable.',
    }))
  } else {
    if (!book.title || book.title.trim().length === 0) {
      bookLevelIssues.push(at({ severity: 'error', code: 'BOOK_NO_TITLE', msg: 'book.json has no title.' }))
    }
    if (!book.description || book.description.trim().length < 20) {
      bookLevelIssues.push(at({
        severity: 'warn',
        code: 'BOOK_THIN_DESCRIPTION',
        msg: `book.json description is empty or <20 chars; library cards will look bare.`,
      }))
    }
    if (!book.author || book.author.trim().length === 0) {
      bookLevelIssues.push(at({
        severity: 'info',
        code: 'BOOK_NO_AUTHOR',
        msg: 'book.json has no author.',
      }))
    }
    if (!book.tags || book.tags.length === 0) {
      bookLevelIssues.push(at({
        severity: 'info',
        code: 'BOOK_NO_TAGS',
        msg: 'book.json has no tags — search and discovery will suffer.',
      }))
    }
    if (typeof book.chapterCount === 'number' && book.chapterCount !== diskChapterIds.length) {
      bookLevelIssues.push(at({
        severity: 'info',
        code: 'BOOK_CHAPTER_COUNT_MISMATCH',
        msg: `book.json chapterCount=${book.chapterCount}, found ${diskChapterIds.length} chapter files.`,
      }))
    }
  }

  // ─ 2. outline.json shape ──────────────────────────────────────────
  if (!outline) {
    bookLevelIssues.push(at({
      severity: 'warn',
      code: 'BOOK_NO_OUTLINE',
      msg: 'outline.json missing — concept graph + cross-refs will not work.',
    }))
  }

  // ─ 3. Orphan / phantom chapters ───────────────────────────────────
  const outlineIds = new Set((outline?.chapters ?? []).map(c => c.id))
  const diskIds = new Set(diskChapterIds)
  for (const id of diskIds) {
    if (outline && !outlineIds.has(id)) {
      bookLevelIssues.push(at({
        severity: 'info',
        code: 'BOOK_ORPHAN_CHAPTER',
        msg: `Chapter file "${id}.json" is on disk but not listed in outline.json.`,
      }))
    }
  }
  for (const id of outlineIds) {
    if (!diskIds.has(id)) {
      bookLevelIssues.push(at({
        severity: 'warn',
        code: 'BOOK_PHANTOM_CHAPTER',
        msg: `outline.json lists "${id}" but no chapter file found.`,
      }))
    }
  }

  // ─ 4. Concept resolution ──────────────────────────────────────────
  const conceptIndex = outline?.conceptIndex ?? {}
  const declaredConcepts = new Set(Object.keys(conceptIndex))
  const referencedConcepts = new Set<string>()
  for (const ch of chapters) for (const c of ch.conceptRefs) referencedConcepts.add(c)

  let unresolvedRefs = 0
  for (const ref of referencedConcepts) {
    if (!declaredConcepts.has(ref)) unresolvedRefs += 1
  }
  if (unresolvedRefs > 0) {
    bookLevelIssues.push(at({
      severity: 'warn',
      code: 'BOOK_UNRESOLVED_CONCEPTS',
      msg: `${unresolvedRefs} of ${referencedConcepts.size} concept references do not resolve in outline.json.`,
      hint: 'Either define the concept (chapter declares it) or fix the [[ref]].',
    }))
  }
  // Concepts declared but never referenced (likely dead concepts):
  let danglingConcepts = 0
  for (const c of declaredConcepts) {
    const meta = conceptIndex[c]
    if ((meta?.referencedIn?.length ?? 0) === 0 && !referencedConcepts.has(c)) {
      danglingConcepts += 1
    }
  }
  if (danglingConcepts > 0 && declaredConcepts.size > 0) {
    bookLevelIssues.push(at({
      severity: 'info',
      code: 'BOOK_DANGLING_CONCEPTS',
      msg: `${danglingConcepts} of ${declaredConcepts.size} concepts are declared but never referenced.`,
    }))
  }

  // ─ 5. Empty book ──────────────────────────────────────────────────
  if (chapters.length === 0) {
    bookLevelIssues.push(at({ severity: 'error', code: 'BOOK_EMPTY', msg: 'Book has zero chapters.' }))
  } else if (chapters.length === 1) {
    bookLevelIssues.push(at({
      severity: 'info',
      code: 'BOOK_SOLO_CHAPTER',
      msg: 'Book has only one chapter — consider folding into another book or expanding.',
    }))
  }

  // ─ 6. Aggregate ───────────────────────────────────────────────────
  const totalBlocks = chapters.reduce((a, c) => a + c.blockCount, 0)
  const diagramCount = chapters.reduce((a, c) => a + c.diagramCount, 0)
  const errors = chapters.reduce((a, c) => a + c.errors, 0) +
    bookLevelIssues.filter(i => i.severity === 'error').length
  const avgScore = chapters.length === 0
    ? 0
    : Math.round((chapters.reduce((a, c) => a + c.score, 0) / chapters.length) * 10) / 10

  return {
    bookId,
    title: book?.title ?? bookId,
    chapterCount: chapters.length,
    diagramCount,
    totalBlocks,
    bookLevelIssues,
    chapters,
    avgScore,
    errors,
  }
}
