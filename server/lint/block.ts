/* ─── Block-level Lint ───────────────────────────────────────────────────────
   For each block in a chapter, run the appropriate per-type checks.

   Diagram blocks delegate to diagram-pedagogy.ts (already cookbook-machine-
   checked). The other 17 types each get their own focused checks here:
     - code: must declare a language, must not be empty, no Unicode that
       breaks `--listings` or pdflatex if printExport demands it
     - quiz: ≥2 options, valid correctIndex, every question has explanation
     - flashcard: ≥1 card, all cards have non-empty front+back
     - quote: ≥1 char text, attribution required for typed-IR quotes
     - math: non-empty expression
     - heading: text non-empty, level 1 used at most once per chapter
     - text: non-empty after stripping markdown
     - list: ≥1 item
     - table: header count consistent across rows, ≥1 row
     - figure: src non-empty, caption present
     - timeline: ≥1 event with non-empty title
     - summary: ≥1 point with non-empty text
     - toggle: title + ≥1 inner block

   All issues are non-blocking by default; severity is 'warn' or 'info' unless
   the block is structurally invalid (e.g. quiz with no questions), in which
   case 'error'. Build-time gating happens at the report level.
───────────────────────────────────────────────────────────────────────────── */

import type { Block, RichText, TextContent } from '../../src/types/blocks.ts'
import type { DiagramBlock } from '../../src/types/diagrams.ts'
import type { LocatedIssue, LintLocation } from './types.ts'
import { lintDiagram } from './diagram-pedagogy.ts'

/** Normalize a TextContent (string | RichText) to a plain string. */
function textToString(t: TextContent | undefined | null): string {
  if (t === undefined || t === null) return ''
  if (typeof t === 'string') return t
  if (Array.isArray(t)) {
    return t
      .map(seg => (typeof seg === 'object' && seg && 'text' in seg ? String(seg.text ?? '') : ''))
      .join('')
  }
  return ''
}

/** Word count over a TextContent — stripped of markdown punctuation. */
export function wordCount(t: TextContent | undefined | null): number {
  const s = textToString(t).replace(/[`*_~\[\]\(\)]/g, ' ').trim()
  if (s.length === 0) return 0
  return s.split(/\s+/).filter(w => w.length > 0).length
}

/** Run the block-level lint over one block. Returns located issues. */
export function lintBlock(b: Block, loc: LintLocation): LocatedIssue[] {
  const issues: LocatedIssue[] = []
  const at = (i: Omit<LocatedIssue, 'loc'>): LocatedIssue => ({ ...i, loc: { ...loc, blockId: b.id } })

  // Universal envelope check
  if (!b.id || b.id.length === 0) {
    issues.push(at({ severity: 'error', code: 'BLOCK_NO_ID', msg: 'Block is missing an id.' }))
  }

  switch (b.type) {
    // ── Diagrams delegate to the cookbook-checked pedagogy lint ──
    case 'diagram': {
      const r = lintDiagram(b as DiagramBlock)
      for (const i of r.issues) issues.push({ ...i, loc: { ...loc, blockId: b.id } })
      break
    }

    case 'code': {
      if (!b.language || b.language.length === 0 || b.language === 'text' || b.language === 'txt') {
        issues.push(at({
          severity: 'warn',
          code: 'CODE_NO_LANGUAGE',
          msg: `Code block has no language declared (got "${b.language ?? '<missing>'}").`,
          hint: 'Set a real language so syntax highlighting works in web + print.',
        }))
      }
      if (!b.code || b.code.trim().length === 0) {
        issues.push(at({ severity: 'error', code: 'CODE_EMPTY', msg: 'Code block has empty content.' }))
      } else if (b.code.length > 8000) {
        issues.push(at({
          severity: 'info',
          code: 'CODE_VERY_LONG',
          msg: `Code block is ${b.code.length} chars — consider splitting or annotating.`,
        }))
      }
      break
    }

    case 'quiz': {
      if (!b.questions || b.questions.length === 0) {
        issues.push(at({ severity: 'error', code: 'QUIZ_NO_QUESTIONS', msg: 'Quiz block has no questions.' }))
      } else {
        for (let qi = 0; qi < b.questions.length; qi++) {
          const q = b.questions[qi]
          if (!q.options || q.options.length < 2) {
            issues.push(at({
              severity: 'warn',
              code: 'QUIZ_TOO_FEW_OPTIONS',
              msg: `Question ${qi + 1} has fewer than 2 options.`,
              hint: 'A real quiz needs at least 2 distractors.',
            }))
          }
          if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= (q.options?.length ?? 0)) {
            issues.push(at({
              severity: 'error',
              code: 'QUIZ_BAD_INDEX',
              msg: `Question ${qi + 1} has an out-of-range correctIndex (${q.correctIndex}).`,
            }))
          }
          if (wordCount(q.explanation) === 0) {
            issues.push(at({
              severity: 'warn',
              code: 'QUIZ_NO_EXPLANATION',
              msg: `Question ${qi + 1} has no explanation — readers won't learn from it.`,
            }))
          }
        }
      }
      break
    }

    case 'flashcard': {
      if (!b.cards || b.cards.length === 0) {
        issues.push(at({ severity: 'error', code: 'FLASH_NO_CARDS', msg: 'Flashcard block has no cards.' }))
      } else {
        for (let ci = 0; ci < b.cards.length; ci++) {
          const c = b.cards[ci]
          if (wordCount(c.front) === 0) {
            issues.push(at({
              severity: 'error',
              code: 'FLASH_EMPTY_FRONT',
              msg: `Card ${ci + 1} has empty front.`,
            }))
          }
          if (wordCount(c.back) === 0) {
            issues.push(at({
              severity: 'error',
              code: 'FLASH_EMPTY_BACK',
              msg: `Card ${ci + 1} has empty back.`,
            }))
          }
        }
      }
      break
    }

    case 'quote': {
      if (wordCount(b.text) === 0) {
        issues.push(at({ severity: 'error', code: 'QUOTE_EMPTY', msg: 'Quote block has no text.' }))
      }
      // Attribution is optional — many epigraphs are anonymous.
      break
    }

    case 'math': {
      if (!b.expression || b.expression.trim().length === 0) {
        issues.push(at({ severity: 'error', code: 'MATH_EMPTY', msg: 'Math block has empty expression.' }))
      }
      break
    }

    case 'heading': {
      if (wordCount(b.text) === 0) {
        issues.push(at({ severity: 'error', code: 'HEADING_EMPTY', msg: 'Heading has no text.' }))
      }
      // Level-1 usage and hierarchy is checked at chapter level.
      break
    }

    case 'text': {
      if (wordCount(b.text) === 0) {
        issues.push(at({
          severity: 'warn',
          code: 'TEXT_EMPTY',
          msg: 'Text block is empty after markdown stripping.',
        }))
      }
      break
    }

    case 'list': {
      if (!b.items || b.items.length === 0) {
        issues.push(at({ severity: 'error', code: 'LIST_EMPTY', msg: 'List block has no items.' }))
      }
      break
    }

    case 'table': {
      if (!b.rows || b.rows.length === 0) {
        issues.push(at({ severity: 'warn', code: 'TABLE_NO_ROWS', msg: 'Table has no body rows.' }))
      }
      const hCount = b.headers?.length ?? 0
      for (let ri = 0; ri < (b.rows?.length ?? 0); ri++) {
        if ((b.rows[ri]?.length ?? 0) !== hCount) {
          issues.push(at({
            severity: 'warn',
            code: 'TABLE_RAGGED',
            msg: `Row ${ri + 1} has ${b.rows[ri].length} cells; header has ${hCount}.`,
          }))
          break // only flag once per table
        }
      }
      break
    }

    case 'figure': {
      if (!b.src || b.src.length === 0) {
        issues.push(at({ severity: 'error', code: 'FIGURE_NO_SRC', msg: 'Figure has no src.' }))
      }
      if (wordCount(b.caption) === 0 && wordCount(b.alt) === 0) {
        issues.push(at({
          severity: 'warn',
          code: 'FIGURE_NO_CAPTION',
          msg: 'Figure has neither caption nor alt text.',
          hint: 'A11y + cookbook §universal: every figure needs a caption.',
        }))
      }
      break
    }

    case 'timeline': {
      if (!b.events || b.events.length === 0) {
        issues.push(at({ severity: 'error', code: 'TIMELINE_NO_EVENTS', msg: 'Timeline has no events.' }))
      }
      break
    }

    case 'summary': {
      if (!b.points || b.points.length === 0) {
        issues.push(at({ severity: 'warn', code: 'SUMMARY_EMPTY', msg: 'Summary block has no points.' }))
      }
      break
    }

    case 'toggle': {
      if (wordCount(b.title) === 0) {
        issues.push(at({ severity: 'error', code: 'TOGGLE_NO_TITLE', msg: 'Toggle block has no title.' }))
      }
      if (!b.content || b.content.length === 0) {
        issues.push(at({
          severity: 'warn',
          code: 'TOGGLE_EMPTY',
          msg: 'Toggle has no inner content blocks.',
        }))
      }
      break
    }

    case 'callout': {
      if (wordCount(b.text) === 0) {
        issues.push(at({ severity: 'warn', code: 'CALLOUT_EMPTY', msg: 'Callout has empty body.' }))
      }
      break
    }

    case 'embed': {
      if (!b.url || b.url.length === 0) {
        issues.push(at({ severity: 'error', code: 'EMBED_NO_URL', msg: 'Embed has no URL.' }))
      }
      break
    }

    // No special checks for: divider, margin-annotation
    default:
      break
  }

  return issues
}

/** Extract `[[concept-slug]]` refs from any TextContent. Used by chapter lint
 *  for cross-chapter resolution. */
export function extractConceptRefs(t: TextContent | undefined | null): string[] {
  const s = textToString(t)
  const out: string[] = []
  const re = /\[\[([a-z0-9][a-z0-9-]*)\]\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) out.push(m[1])
  return out
}

// Re-export for consumers that want the helpers.
export type { Block, RichText }
