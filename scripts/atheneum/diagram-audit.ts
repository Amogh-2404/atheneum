#!/usr/bin/env tsx
/* ─── Atheneum Diagram Audit ─────────────────────────────────────────────────
   Walks every chapter in every book, finds every diagram block, runs:
     1. Zod validation (against the new IR — backward-compatible)
     2. Pedagogy lint (cookbook universal rules, machine-checked)
   Then writes:
     - build/diagram-audit.json — full per-diagram report
     - build/diagram-audit.md   — human summary, top issues, per-book scores
   And prints a one-screen summary to stdout.

   Run:
     cd ~/the-codex && npx tsx scripts/atheneum/diagram-audit.ts
───────────────────────────────────────────────────────────────────────────── */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { DiagramBlockSchema } from '../../src/types/diagrams.ts'
import type {
  DiagramBlock,
  DiagramCategory,
  DiagramEngine,
  LintIssue,
} from '../../src/types/diagrams.ts'
import {
  effectiveEngine,
  effectiveCategory,
} from '../../src/types/diagrams.ts'
import { lintDiagram } from '../../server/lint/diagram-pedagogy.ts'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')
const CONTENT_DIR = path.join(ROOT, 'content')
const BUILD_DIR = path.join(ROOT, 'build')

interface DiagramAuditEntry {
  bookId: string
  chapterId: string
  blockId: string
  engine: DiagramEngine
  category: DiagramCategory
  isTyped: boolean
  validationOk: boolean
  validationError?: string
  score: number
  errors: number
  issues: LintIssue[]
}

interface AuditReport {
  generatedAt: string
  totals: {
    books: number
    chapters: number
    diagrams: number
    typed: number
    legacy: number
    invalidating: number
    avgScore: number
    perfectDiagrams: number   // score === 100
    failingDiagrams: number   // errors > 0 OR score < 60
  }
  perBook: Record<string, {
    chapters: number
    diagrams: number
    avgScore: number
    failingDiagrams: number
  }>
  perEngine: Record<string, number>
  perCategory: Record<string, number>
  topIssues: Array<{ code: string; count: number; example: string }>
  entries: DiagramAuditEntry[]
}

async function listDirs(p: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(p, { withFileTypes: true })
    return entries.filter(e => e.isDirectory()).map(e => e.name)
  } catch {
    return []
  }
}

async function listJsonFiles(p: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(p, { withFileTypes: true })
    return entries
      .filter(e => e.isFile() && e.name.endsWith('.json'))
      .map(e => e.name)
  } catch {
    return []
  }
}

async function readJson<T>(p: string): Promise<T | null> {
  try {
    const buf = await fs.readFile(p, 'utf-8')
    return JSON.parse(buf) as T
  } catch {
    return null
  }
}

interface ChapterShape {
  id: string
  blocks: Array<Record<string, unknown>>
}

async function audit(): Promise<AuditReport> {
  const startedAt = new Date().toISOString()
  const entries: DiagramAuditEntry[] = []
  const perBook: AuditReport['perBook'] = {}
  const perEngine: Record<string, number> = {}
  const perCategory: Record<string, number> = {}
  const issueCounter = new Map<string, { count: number; example: string }>()

  let totalChapters = 0
  let invalidating = 0

  const bookDirs = (await listDirs(CONTENT_DIR)).filter(b => !b.startsWith('.') && b !== '_index.json')

  for (const bookId of bookDirs) {
    const chaptersDir = path.join(CONTENT_DIR, bookId, 'chapters')
    const chapterFiles = await listJsonFiles(chaptersDir)
    if (chapterFiles.length === 0) continue

    let bookDiagrams = 0
    let bookScoreSum = 0
    let bookFailing = 0

    for (const cf of chapterFiles) {
      totalChapters += 1
      const chapter = await readJson<ChapterShape>(path.join(chaptersDir, cf))
      if (!chapter || !Array.isArray(chapter.blocks)) continue

      for (const raw of chapter.blocks) {
        if ((raw as { type?: unknown }).type !== 'diagram') continue

        // Validate against the new IR (backward-compat — legacy diagrams pass).
        const parsed = DiagramBlockSchema.safeParse(raw)
        if (!parsed.success) {
          invalidating += 1
          const blockId = String((raw as { id?: unknown }).id ?? '<no-id>')
          entries.push({
            bookId,
            chapterId: chapter.id,
            blockId,
            engine: 'sketch',
            category: 'sketchnote',
            isTyped: false,
            validationOk: false,
            validationError: parsed.error.issues
              .slice(0, 3)
              .map(i => `${i.path.join('.')}: ${i.message}`)
              .join(' | '),
            score: 0,
            errors: 1,
            issues: [{
              severity: 'error',
              code: 'DIAG_INVALID',
              msg: 'Diagram block fails IR validation.',
              hint: parsed.error.issues[0]?.message,
            }],
          })
          continue
        }

        const d: DiagramBlock = parsed.data
        const lint = lintDiagram(d)
        const engine = effectiveEngine(d)
        const category = effectiveCategory(d)

        perEngine[engine] = (perEngine[engine] ?? 0) + 1
        perCategory[category] = (perCategory[category] ?? 0) + 1
        bookDiagrams += 1
        bookScoreSum += lint.score
        if (lint.errors > 0 || lint.score < 60) bookFailing += 1

        for (const issue of lint.issues) {
          const cur = issueCounter.get(issue.code) ?? { count: 0, example: issue.msg }
          cur.count += 1
          issueCounter.set(issue.code, cur)
        }

        entries.push({
          bookId,
          chapterId: chapter.id,
          blockId: d.id,
          engine,
          category,
          isTyped: d.spec !== undefined,
          validationOk: true,
          score: lint.score,
          errors: lint.errors,
          issues: lint.issues,
        })
      }
    }

    perBook[bookId] = {
      chapters: chapterFiles.length,
      diagrams: bookDiagrams,
      avgScore: bookDiagrams === 0 ? 0 : Math.round((bookScoreSum / bookDiagrams) * 10) / 10,
      failingDiagrams: bookFailing,
    }
  }

  const totalDiagrams = entries.length
  const typed = entries.filter(e => e.isTyped).length
  const legacy = totalDiagrams - typed - invalidating
  const totalScoreSum = entries.reduce((acc, e) => acc + e.score, 0)
  const avgScore = totalDiagrams === 0 ? 0 : Math.round((totalScoreSum / totalDiagrams) * 10) / 10
  const perfect = entries.filter(e => e.score === 100).length
  const failing = entries.filter(e => e.errors > 0 || e.score < 60).length

  const topIssues = [...issueCounter.entries()]
    .map(([code, { count, example }]) => ({ code, count, example }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  return {
    generatedAt: startedAt,
    totals: {
      books: bookDirs.length,
      chapters: totalChapters,
      diagrams: totalDiagrams,
      typed,
      legacy,
      invalidating,
      avgScore,
      perfectDiagrams: perfect,
      failingDiagrams: failing,
    },
    perBook,
    perEngine,
    perCategory,
    topIssues,
    entries,
  }
}

function formatMarkdown(r: AuditReport): string {
  const lines: string[] = []
  lines.push('# Atheneum Diagram Audit')
  lines.push('')
  lines.push(`Generated: \`${r.generatedAt}\``)
  lines.push('')
  lines.push('## Totals')
  lines.push('')
  lines.push(`- Books: **${r.totals.books}** · Chapters: **${r.totals.chapters}** · Diagrams: **${r.totals.diagrams}**`)
  lines.push(`- Typed (new IR): **${r.totals.typed}** · Legacy (Excalidraw-only): **${r.totals.legacy}** · Invalidating: **${r.totals.invalidating}**`)
  lines.push(`- Avg pedagogy score: **${r.totals.avgScore}/100**`)
  lines.push(`- Perfect (100): **${r.totals.perfectDiagrams}** · Failing (errors>0 OR score<60): **${r.totals.failingDiagrams}**`)
  lines.push('')
  lines.push('## Per-book')
  lines.push('')
  lines.push('| Book | Chapters | Diagrams | Avg score | Failing |')
  lines.push('|---|---:|---:|---:|---:|')
  for (const [book, s] of Object.entries(r.perBook)) {
    lines.push(`| \`${book}\` | ${s.chapters} | ${s.diagrams} | ${s.avgScore} | ${s.failingDiagrams} |`)
  }
  lines.push('')
  lines.push('## Per-engine breakdown')
  lines.push('')
  lines.push('| Engine | Count |')
  lines.push('|---|---:|')
  for (const [eng, n] of Object.entries(r.perEngine).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${eng} | ${n} |`)
  }
  lines.push('')
  lines.push('## Per-category breakdown')
  lines.push('')
  lines.push('| Category | Count |')
  lines.push('|---|---:|')
  for (const [cat, n] of Object.entries(r.perCategory).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${cat} | ${n} |`)
  }
  lines.push('')
  lines.push('## Top issues')
  lines.push('')
  lines.push('| Code | Count | Example |')
  lines.push('|---|---:|---|')
  for (const t of r.topIssues) {
    lines.push(`| \`${t.code}\` | ${t.count} | ${t.example.replace(/\|/g, '\\|')} |`)
  }
  lines.push('')
  return lines.join('\n')
}

async function main() {
  console.log('▸ Atheneum Diagram Audit')
  const report = await audit()

  await fs.mkdir(BUILD_DIR, { recursive: true })
  await fs.writeFile(
    path.join(BUILD_DIR, 'diagram-audit.json'),
    JSON.stringify(report, null, 2),
  )
  await fs.writeFile(
    path.join(BUILD_DIR, 'diagram-audit.md'),
    formatMarkdown(report),
  )

  // ── stdout summary ──
  const t = report.totals
  console.log('')
  console.log(`  Books:     ${t.books}`)
  console.log(`  Chapters:  ${t.chapters}`)
  console.log(`  Diagrams:  ${t.diagrams}  (typed: ${t.typed}, legacy: ${t.legacy}, invalidating: ${t.invalidating})`)
  console.log(`  Avg score: ${t.avgScore}/100`)
  console.log(`  Perfect:   ${t.perfectDiagrams}`)
  console.log(`  Failing:   ${t.failingDiagrams}`)
  console.log('')
  console.log('  Per-book:')
  for (const [book, s] of Object.entries(report.perBook)) {
    console.log(`    ${book.padEnd(28)} ${String(s.diagrams).padStart(4)} diagrams · avg ${String(s.avgScore).padStart(5)} · failing ${s.failingDiagrams}`)
  }
  console.log('')
  console.log('  Top 5 issues:')
  for (const i of report.topIssues.slice(0, 5)) {
    console.log(`    ${i.code.padEnd(28)} ${String(i.count).padStart(4)}  ${i.example.slice(0, 60)}`)
  }
  console.log('')
  console.log(`  Wrote: ${path.relative(ROOT, path.join(BUILD_DIR, 'diagram-audit.json'))}`)
  console.log(`  Wrote: ${path.relative(ROOT, path.join(BUILD_DIR, 'diagram-audit.md'))}`)
}

main().catch(err => {
  console.error('Audit failed:', err)
  process.exit(1)
})
