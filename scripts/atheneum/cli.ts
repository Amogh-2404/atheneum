#!/usr/bin/env tsx
/* ─── Atheneum CLI ───────────────────────────────────────────────────────────
   Single entrypoint for the content compiler. Subcommands:

     atheneum lint [bookId]     — full IR lint over one or all books
     atheneum diagrams [bookId] — diagram-only audit (faster subset of lint)
     atheneum stats             — high-level corpus stats
     atheneum help              — this message

   Outputs:
     build/atheneum-lint.json   — full machine-readable lint report
     build/atheneum-lint.md     — human summary, top issues, per-book scores

   Exits non-zero if any error-severity issue is found in the requested scope.
───────────────────────────────────────────────────────────────────────────── */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Block } from '../../src/types/blocks.ts'
import type { Chapter } from '../../src/types/book.ts'
import type {
  AtheneumLintReport,
  BookLintResult,
} from '../../server/lint/types.ts'
import { lintChapter } from '../../server/lint/chapter.ts'
import type { ChapterLintOutput } from '../../server/lint/chapter.ts'
import { lintBook } from '../../server/lint/book.ts'
import { runBlockPasses } from '../../server/passes/types.ts'
import type { BlockPass, PassRunReport } from '../../server/passes/types.ts'
import { FixCodeLanguagePass } from '../../server/passes/fix-code-language.ts'
import { AsciiArtToFigurePass } from '../../server/passes/ascii-art-to-figure.ts'
import { TagPseudocodePass } from '../../server/passes/tag-pseudocode.ts'
import { CodexBackend } from '../../server/backends/codex.ts'
import { PdfBackend } from '../../server/backends/pdf.ts'
import type { BookInput, Backend } from '../../server/backends/types.ts'
import { markdownToChapter } from '../../server/frontend/markdown.ts'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')
const CONTENT_DIR = path.join(ROOT, 'content')
const BUILD_DIR = path.join(ROOT, 'build')

// ─── I/O helpers ────────────────────────────────────────────────────

async function listDirs(p: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(p, { withFileTypes: true })
    return entries.filter(e => e.isDirectory()).map(e => e.name).filter(n => !n.startsWith('.'))
  } catch { return [] }
}

async function listJsonFiles(p: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(p, { withFileTypes: true })
    return entries.filter(e => e.isFile() && e.name.endsWith('.json')).map(e => e.name)
  } catch { return [] }
}

async function readJson<T>(p: string): Promise<T | null> {
  try { return JSON.parse(await fs.readFile(p, 'utf-8')) as T } catch { return null }
}

// ─── Lint: one book ─────────────────────────────────────────────────

async function lintOneBook(bookId: string): Promise<BookLintResult> {
  const bookDir = path.join(CONTENT_DIR, bookId)
  const chaptersDir = path.join(bookDir, 'chapters')

  const book = await readJson<Record<string, unknown>>(path.join(bookDir, 'book.json'))
  const outline = await readJson<Record<string, unknown>>(path.join(bookDir, 'outline.json'))

  const chapterFiles = await listJsonFiles(chaptersDir)
  const diskIds: string[] = []
  const chapterResults: ChapterLintOutput[] = []
  for (const cf of chapterFiles) {
    const ch = await readJson<Chapter & { blocks: Block[] }>(path.join(chaptersDir, cf))
    if (!ch) continue
    diskIds.push(ch.id)
    chapterResults.push(lintChapter({ bookId, chapter: ch }))
  }

  return lintBook({
    bookId,
    book: (book as never) ?? null,
    outline: (outline as never) ?? null,
    chapters: chapterResults,
    diskChapterIds: diskIds,
  })
}

// ─── Lint: whole corpus ─────────────────────────────────────────────

async function lintCorpus(scope?: string): Promise<AtheneumLintReport> {
  const startedAt = new Date().toISOString()
  const allBookIds = await listDirs(CONTENT_DIR)
  const targetBooks = scope ? allBookIds.filter(b => b === scope) : allBookIds
  if (scope && targetBooks.length === 0) {
    throw new Error(`No book named "${scope}" in content/`)
  }

  const perBook: BookLintResult[] = []
  for (const bookId of targetBooks) perBook.push(await lintOneBook(bookId))

  // ─ Aggregate ─
  let totalChapters = 0
  let totalBlocks = 0
  let totalDiagrams = 0
  let totalIssues = 0
  let totalErrors = 0
  let scoreSum = 0
  let scoreN = 0
  const issueCounter = new Map<string, { count: number; example: string }>()

  for (const b of perBook) {
    totalChapters += b.chapterCount
    totalBlocks += b.totalBlocks
    totalDiagrams += b.diagramCount
    totalErrors += b.errors
    for (const ch of b.chapters) {
      totalIssues += ch.issues.length
      scoreSum += ch.score
      scoreN += 1
      for (const i of ch.issues) {
        const cur = issueCounter.get(i.code) ?? { count: 0, example: i.msg }
        cur.count += 1
        issueCounter.set(i.code, cur)
      }
    }
    totalIssues += b.bookLevelIssues.length
    for (const i of b.bookLevelIssues) {
      const cur = issueCounter.get(i.code) ?? { count: 0, example: i.msg }
      cur.count += 1
      issueCounter.set(i.code, cur)
    }
  }

  const topIssues = [...issueCounter.entries()]
    .map(([code, { count, example }]) => ({ code, count, example }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25)

  return {
    generatedAt: startedAt,
    totals: {
      books: perBook.length,
      chapters: totalChapters,
      blocks: totalBlocks,
      diagrams: totalDiagrams,
      issues: totalIssues,
      errors: totalErrors,
      avgScore: scoreN === 0 ? 0 : Math.round((scoreSum / scoreN) * 10) / 10,
    },
    perBook,
    topIssues,
  }
}

// ─── Markdown formatter ─────────────────────────────────────────────

function formatMd(r: AtheneumLintReport): string {
  const lines: string[] = []
  lines.push('# Atheneum Lint Report')
  lines.push('')
  lines.push(`Generated: \`${r.generatedAt}\``)
  lines.push('')
  lines.push('## Corpus totals')
  lines.push('')
  lines.push(`- Books: **${r.totals.books}** · Chapters: **${r.totals.chapters}** · Blocks: **${r.totals.blocks}** · Diagrams: **${r.totals.diagrams}**`)
  lines.push(`- Issues: **${r.totals.issues}** (errors: **${r.totals.errors}**)`)
  lines.push(`- Avg chapter score: **${r.totals.avgScore}/100**`)
  lines.push('')
  lines.push('## Per-book')
  lines.push('')
  lines.push('| Book | Chapters | Blocks | Diagrams | Avg score | Errors |')
  lines.push('|---|---:|---:|---:|---:|---:|')
  for (const b of r.perBook) {
    lines.push(`| \`${b.bookId}\` | ${b.chapterCount} | ${b.totalBlocks} | ${b.diagramCount} | ${b.avgScore} | ${b.errors} |`)
  }
  lines.push('')
  lines.push('## Top 25 issues')
  lines.push('')
  lines.push('| Code | Count | Example |')
  lines.push('|---|---:|---|')
  for (const t of r.topIssues) {
    lines.push(`| \`${t.code}\` | ${t.count} | ${t.example.slice(0, 80).replace(/\|/g, '\\|')} |`)
  }
  lines.push('')
  // ─ Per-book deep section: top 5 issue codes per book ─
  lines.push('## Per-book breakdown')
  lines.push('')
  for (const b of r.perBook) {
    lines.push(`### \`${b.bookId}\` — ${b.title}`)
    lines.push('')
    lines.push(`Score **${b.avgScore}/100** · ${b.chapterCount} chapters · ${b.diagramCount} diagrams · ${b.errors} errors`)
    lines.push('')
    if (b.bookLevelIssues.length > 0) {
      lines.push('Book-level issues:')
      for (const i of b.bookLevelIssues.slice(0, 8)) {
        lines.push(`- \`${i.code}\` (${i.severity}): ${i.msg}`)
      }
      lines.push('')
    }
    // Bottom 3 chapters by score
    const worst = [...b.chapters].sort((a, c) => a.score - c.score).slice(0, 3)
    if (worst.length > 0 && worst[0].score < 100) {
      lines.push('Lowest-scoring chapters:')
      for (const c of worst) {
        lines.push(`- \`${c.chapterId}\` — score ${c.score}, ${c.errors} errors, ${c.issues.length} issues`)
      }
      lines.push('')
    }
  }
  return lines.join('\n')
}

// ─── stdout summary ─────────────────────────────────────────────────

function printSummary(r: AtheneumLintReport) {
  const t = r.totals
  console.log('')
  console.log(`  Books:        ${t.books}`)
  console.log(`  Chapters:     ${t.chapters}`)
  console.log(`  Blocks:       ${t.blocks}`)
  console.log(`  Diagrams:     ${t.diagrams}`)
  console.log(`  Issues:       ${t.issues}  (errors: ${t.errors})`)
  console.log(`  Avg score:    ${t.avgScore}/100`)
  console.log('')
  console.log('  Per-book:')
  for (const b of r.perBook) {
    const flag = b.errors > 0 ? ' ⚠' : ''
    console.log(`    ${b.bookId.padEnd(28)} ${String(b.chapterCount).padStart(3)} ch · ${String(b.totalBlocks).padStart(5)} bl · ${String(b.diagramCount).padStart(3)} diag · score ${String(b.avgScore).padStart(5)} · ${b.errors} err${flag}`)
  }
  console.log('')
  console.log('  Top 5 issue codes:')
  for (const t2 of r.topIssues.slice(0, 5)) {
    console.log(`    ${t2.code.padEnd(32)} ${String(t2.count).padStart(5)}  ${t2.example.slice(0, 60)}`)
  }
  console.log('')
}

// ─── Subcommands ────────────────────────────────────────────────────

async function cmdLint(scope?: string): Promise<number> {
  console.log(`▸ atheneum lint${scope ? ` ${scope}` : ' (all books)'}`)
  const r = await lintCorpus(scope)
  await fs.mkdir(BUILD_DIR, { recursive: true })
  await fs.writeFile(path.join(BUILD_DIR, 'atheneum-lint.json'), JSON.stringify(r, null, 2))
  await fs.writeFile(path.join(BUILD_DIR, 'atheneum-lint.md'), formatMd(r))
  printSummary(r)
  console.log(`  Wrote: ${path.relative(ROOT, path.join(BUILD_DIR, 'atheneum-lint.json'))}`)
  console.log(`  Wrote: ${path.relative(ROOT, path.join(BUILD_DIR, 'atheneum-lint.md'))}`)
  return r.totals.errors > 0 ? 1 : 0
}

async function cmdStats(): Promise<number> {
  const r = await lintCorpus()
  console.log('')
  console.log(`Atheneum corpus stats — ${r.generatedAt}`)
  console.log('')
  printSummary(r)
  return 0
}

// ─── fix: run pass pipeline, write back changed chapters ────────────

const PASS_PIPELINE: readonly BlockPass[] = [
  // Order matters:
  //   1. Promote ASCII art FIRST (before lang detection sees it).
  AsciiArtToFigurePass,
  //   2. Tag pseudocode BEFORE fix-code-language (pseudocode signals
  //      stronger than weak language hints).
  TagPseudocodePass,
  //   3. Then language-tag the remaining genuine code blocks.
  FixCodeLanguagePass,
  // Future passes: ExtractDrills, ExtractQbank, ExtractSummary,
  // HarvestConcepts, BuildOutline.
]

interface FixSummary {
  bookId: string
  chapterId: string
  changedBlocks: number
  reports: PassRunReport[]
}

async function cmdFix(scope?: string, dryRun = false): Promise<number> {
  console.log(`▸ atheneum fix${scope ? ` ${scope}` : ' (all books)'}${dryRun ? ' [DRY RUN]' : ''}`)
  const allBooks = await listDirs(CONTENT_DIR)
  const books = scope ? allBooks.filter(b => b === scope) : allBooks
  if (scope && books.length === 0) {
    console.error(`No book named "${scope}" in content/`)
    return 1
  }

  const summaries: FixSummary[] = []
  let totalChaptersTouched = 0
  let totalBlocksTouched = 0

  for (const bookId of books) {
    const chDir = path.join(CONTENT_DIR, bookId, 'chapters')
    const files = await listJsonFiles(chDir)
    for (const cf of files) {
      const ch = await readJson<Chapter & { blocks: Block[] }>(path.join(chDir, cf))
      if (!ch) continue
      const result = runBlockPasses(ch, PASS_PIPELINE, { bookId })
      if (!result.changed) continue
      const touched = result.passReports.reduce((a, r) => a + r.touched, 0)
      summaries.push({
        bookId,
        chapterId: ch.id,
        changedBlocks: touched,
        reports: result.passReports,
      })
      totalChaptersTouched += 1
      totalBlocksTouched += touched
      if (!dryRun) {
        await fs.writeFile(
          path.join(chDir, cf),
          JSON.stringify(result.chapter, null, 2),
        )
      }
    }
  }

  console.log('')
  console.log(`  Chapters touched: ${totalChaptersTouched}`)
  console.log(`  Blocks touched:   ${totalBlocksTouched}`)
  console.log('')
  // Per-pass roll-up
  const perPass = new Map<string, number>()
  for (const s of summaries) for (const r of s.reports) {
    if (r.changed) perPass.set(r.passName, (perPass.get(r.passName) ?? 0) + r.touched)
  }
  if (perPass.size > 0) {
    console.log('  Per pass:')
    for (const [n, c] of perPass) console.log(`    ${n.padEnd(28)} ${c} blocks`)
    console.log('')
  }
  if (dryRun) {
    console.log('  (dry run — no files written; re-run without --dry-run to apply)')
  }
  return 0
}

// ─── build: backend pipeline ────────────────────────────────────────

async function loadBookInput(bookId: string): Promise<BookInput | null> {
  const bookDir = path.join(CONTENT_DIR, bookId)
  const bookMeta = await readJson<Record<string, unknown>>(path.join(bookDir, 'book.json'))
  if (!bookMeta) return null
  const outline = await readJson<Record<string, unknown>>(path.join(bookDir, 'outline.json'))
  const chaptersDir = path.join(bookDir, 'chapters')
  const files = await listJsonFiles(chaptersDir)
  const chapters: Chapter[] = []
  for (const cf of files) {
    const ch = await readJson<Chapter>(path.join(chaptersDir, cf))
    if (ch) chapters.push(ch)
  }
  return { bookId, bookMeta, outline, chapters }
}

function pickBackend(target: string): Backend | null {
  switch (target) {
    case 'codex': return CodexBackend
    case 'pdf':   return PdfBackend
    default:      return null
  }
}

async function cmdBuild(scope: string | undefined, target: string, dryRun: boolean, compile: boolean): Promise<number> {
  console.log(`▸ atheneum build${scope ? ` ${scope}` : ' (all books)'} --target=${target}${dryRun ? ' [DRY RUN]' : ''}${compile ? ' [COMPILE]' : ''}`)
  const targets = target === 'all' ? ['codex', 'pdf'] : [target]
  for (const t of targets) {
    if (!pickBackend(t)) {
      console.error(`Unknown target "${t}". Available: codex, pdf, all.`)
      return 1
    }
  }
  const allBooks = await listDirs(CONTENT_DIR)
  const books = scope ? allBooks.filter(b => b === scope) : allBooks

  let grandBytes = 0
  let grandArtifacts = 0
  let grandNotes = 0

  for (const t of targets) {
    const backend = pickBackend(t)
    if (!backend) continue
    const outRoot = path.join(BUILD_DIR, t)
    if (!dryRun) await fs.mkdir(outRoot, { recursive: true })

    console.log(`  ─ target ${t} ─────────────────────────────`)
    let totalBytes = 0
    let totalArtifacts = 0
    let totalNotes = 0
    for (const bookId of books) {
      const input = await loadBookInput(bookId)
      if (!input) {
        console.error(`  skip ${bookId}: no book.json`)
        continue
      }
      const result = await backend.run(input, { outRoot, dryRun, compile } as never)
      totalBytes += result.totalBytes
      totalArtifacts += result.artifacts.length
      totalNotes += result.notes.length
      const note = result.notes.length > 0 ? ` (${result.notes.length} notes)` : ''
      console.log(`    ${bookId.padEnd(28)} ${String(result.artifacts.length).padStart(4)} files · ${String(Math.round(result.totalBytes / 1024)).padStart(6)} KB · ${result.durationMs}ms${note}`)
      for (const n of result.notes.slice(0, 3)) {
        if (n.severity === 'error' || n.severity === 'warn') {
          console.log(`      [${n.severity}] ${n.code}: ${n.msg.slice(0, 140)}`)
        }
      }
    }
    console.log(`    subtotal: ${totalArtifacts} files, ${Math.round(totalBytes / 1024)} KB${totalNotes ? `, ${totalNotes} notes` : ''}`)
    console.log(`    output:   ${path.relative(ROOT, outRoot)}`)
    grandBytes += totalBytes
    grandArtifacts += totalArtifacts
    grandNotes += totalNotes
  }
  if (targets.length > 1) {
    console.log('')
    console.log(`  GRAND TOTAL: ${grandArtifacts} files, ${Math.round(grandBytes / 1024)} KB${grandNotes ? `, ${grandNotes} notes` : ''}`)
  }
  return 0
}

// ─── import: markdown frontend → BookInput → CodexBackend ──────────

const META_DROP = new Set([
  '00_cover.md', '01_how_to_use.md', '02_master_plan.md', '03_executive_summary.md',
])

interface ImportOpts {
  bookId: string
  srcDir: string
  /** Output root — book dir is created INSIDE this. Defaults to content/. */
  outRoot?: string
  dryRun?: boolean
}

async function cmdImport(opts: ImportOpts): Promise<number> {
  console.log(`▸ atheneum import ${opts.bookId} from ${path.relative(ROOT, opts.srcDir)}${opts.dryRun ? ' [DRY RUN]' : ''}`)
  const sections = (await listDirs(opts.srcDir))
    .filter(s => /^\d/.test(s))
    .sort()
  if (sections.length === 0) {
    console.error(`  no numbered section dirs in ${opts.srcDir}`)
    return 1
  }

  const chapters: Chapter[] = []
  const chapterMeta: Array<{ id: string; title: string; concepts: string[]; prereqs: string[]; estimatedBlocks: number; status: string }> = []
  let chapterNumber = 0
  let totalBytes = 0

  for (const section of sections) {
    const sectionDir = path.join(opts.srcDir, section)
    const files = (await listJsonFiles(sectionDir)).filter(f => false) // none — we want .md
    const allEntries = await fs.readdir(sectionDir, { withFileTypes: true })
    const mdFiles = allEntries
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => e.name)
      .sort()
    for (const mdName of mdFiles) {
      if (META_DROP.has(mdName)) continue
      const filePath = path.join(sectionDir, mdName)
      const stat = await fs.stat(filePath)
      if (stat.size < 500) continue  // skip stubs

      chapterNumber += 1
      const md = await fs.readFile(filePath, 'utf-8')
      const result = markdownToChapter(md, {
        bookId: opts.bookId,
        section,
        chapterNumber,
      })
      chapters.push(result.chapter)
      chapterMeta.push({
        id: result.chapter.id,
        title: result.chapter.title,
        concepts: result.conceptSlugs,
        prereqs: [],
        estimatedBlocks: result.meta.blockCount,
        status: 'complete',
      })
      totalBytes += md.length
    }
  }

  // Generate outline.json conceptIndex
  const conceptIndex: Record<string, { definedIn: string; referencedIn: string[]; prerequisites: string[] }> = {}
  for (const cm of chapterMeta) {
    if (cm.concepts.length === 0) continue
    const primary = cm.concepts[0]
    if (!conceptIndex[primary]) {
      conceptIndex[primary] = { definedIn: cm.id, referencedIn: [], prerequisites: [] }
    }
    for (const c of cm.concepts.slice(1)) {
      if (!conceptIndex[c]) {
        conceptIndex[c] = { definedIn: cm.id, referencedIn: [], prerequisites: [] }
      } else if (!conceptIndex[c].referencedIn.includes(cm.id) && conceptIndex[c].definedIn !== cm.id) {
        conceptIndex[c].referencedIn.push(cm.id)
      }
    }
  }
  const outline = {
    _schema: 1,
    bookId: opts.bookId,
    chapters: chapterMeta,
    conceptIndex,
  }

  // Resolve book.json — use existing if present, else generate stub.
  // Semantics: outRoot is the parent dir; the bookId dir lives inside it.
  const outRoot = opts.outRoot ?? CONTENT_DIR
  const bookDir = path.join(outRoot, opts.bookId)
  let bookMeta: Record<string, unknown>
  const existingBookPath = path.join(bookDir, 'book.json')
  const existing = await readJson<Record<string, unknown>>(existingBookPath)
  if (existing) {
    bookMeta = { ...existing, chapterCount: chapters.length, updatedAt: new Date().toISOString() }
  } else {
    bookMeta = {
      _schema: 1,
      id: opts.bookId,
      title: opts.bookId,
      author: 'Atheneum',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      coverColor: '#2c1810',
      status: 'draft',
      tags: [],
      chapterCount: chapters.length,
    }
  }

  const input: BookInput = {
    bookId: opts.bookId,
    bookMeta,
    outline,
    chapters,
  }

  const result = await CodexBackend.run(input, {
    outRoot,
    dryRun: opts.dryRun ?? false,
  })

  // ─ Sweep orphans: any chapter file on disk whose id is not in the
  //   freshly-imported chapter set is stale (renumbering / source removal).
  //   Delete it so the web reader doesn't surface ghost chapters.
  let orphansDeleted = 0
  if (!opts.dryRun) {
    const writtenIds = new Set(chapters.map(ch => ch.id))
    const chaptersOutDir = path.join(bookDir, 'chapters')
    try {
      const existing = await fs.readdir(chaptersOutDir)
      for (const f of existing) {
        if (!f.endsWith('.json')) continue
        const id = f.slice(0, -'.json'.length)
        if (!writtenIds.has(id)) {
          await fs.unlink(path.join(chaptersOutDir, f))
          orphansDeleted += 1
        }
      }
    } catch { /* dir doesn't exist yet — nothing to sweep */ }
  }

  console.log('')
  console.log(`  Source files:     ${chapters.length} chapters parsed`)
  console.log(`  Source bytes:     ${Math.round(totalBytes / 1024)} KB`)
  console.log(`  Output artifacts: ${result.artifacts.length} files (${Math.round(result.totalBytes / 1024)} KB)`)
  console.log(`  Concepts:         ${Object.keys(conceptIndex).length} indexed`)
  if (orphansDeleted > 0) console.log(`  Orphans swept:    ${orphansDeleted} stale chapter files removed`)
  console.log(`  Duration:         ${result.durationMs}ms`)
  if (result.notes.length > 0) {
    console.log(`  Notes:            ${result.notes.length}`)
    for (const n of result.notes.slice(0, 5)) console.log(`    [${n.severity}] ${n.code}: ${n.msg}`)
  }
  console.log(`  Output: ${path.relative(ROOT, bookDir)}`)
  return 0
}

// ─── dev: chokidar watcher → re-lint on change ──────────────────────

async function cmdDev(): Promise<number> {
  console.log('▸ atheneum dev — watching content/**/*.json (Ctrl-C to stop)')
  const chokidar = await import('chokidar')
  let inFlight = false
  let pending = false
  const watcher = chokidar.watch(path.join(CONTENT_DIR, '**/*.json'), {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200 },
  })
  const trigger = async (file: string) => {
    if (inFlight) { pending = true; return }
    inFlight = true
    const rel = path.relative(ROOT, file)
    console.log(`\n  ▸ change: ${rel}`)
    // Infer the affected book from the path
    const parts = path.relative(CONTENT_DIR, file).split(path.sep)
    const bookId = parts[0]
    try {
      await cmdLint(bookId)
    } catch (err) {
      console.error('  lint failed:', err instanceof Error ? err.message : err)
    } finally {
      inFlight = false
      if (pending) { pending = false; trigger(file) }
    }
  }
  watcher.on('add', trigger).on('change', trigger).on('unlink', trigger)
  await new Promise(() => { /* run forever */ })
  return 0
}

function cmdHelp(): number {
  console.log(`atheneum — content compiler CLI

Usage:
  atheneum lint [bookId]       Run full IR lint over one or all books
  atheneum diagrams [bookId]   Run diagram-only audit (subset of lint)
  atheneum fix [bookId] [--dry-run]
                               Run pass pipeline (auto-fix lint findings)
  atheneum build [bookId] [--target=codex|pdf|all] [--dry-run] [--compile]
                               Run target backend(s) over the corpus
                               (--compile invokes lualatex for pdf target)
  atheneum import <bookId> <srcDir> [--out=<dir>] [--dry-run]
                               Markdown frontend → IR → CodexBackend
  atheneum dev                 Watch content/, re-lint on file change
  atheneum stats               Print corpus stats
  atheneum help                Show this message

Pipeline passes (in order):
  - AsciiArtToFigure           Promote ASCII art → custom-svg diagrams
  - TagPseudocode              Tag English-flow-control code as "pseudocode"
  - FixCodeLanguage            Auto-detect language for remaining code blocks

Backends:
  - codex                      Web reader JSON corpus (book/outline/chapters)
  (PDF, EPUB, Anki, Audio backends arrive in Phase B)

Outputs (when run from ${ROOT}):
  build/atheneum-lint.json     Machine-readable full report
  build/atheneum-lint.md       Human summary
  build/codex/<bookId>/        Codex backend artifacts (build target)

Exit code: non-zero if any error-severity issues found in scope.
`)
  return 0
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2)
  const cmd = argv[0]
  // Find first non-flag argument as the scope.
  const scope = argv.slice(1).find(a => !a.startsWith('--'))
  const dryRun = argv.includes('--dry-run')
  let exit = 0
  try {
    switch (cmd) {
      case 'lint':     exit = await cmdLint(scope); break
      case 'diagrams': {
        const { spawn } = await import('node:child_process')
        const child = spawn('npx', ['tsx', path.join(ROOT, 'scripts/atheneum/diagram-audit.ts'), ...(scope ? [scope] : [])], { stdio: 'inherit' })
        await new Promise<void>(res => child.on('exit', () => res()))
        break
      }
      case 'fix':      exit = await cmdFix(scope, dryRun); break
      case 'build': {
        const targetArg = argv.find(a => a.startsWith('--target='))
        const target = targetArg ? targetArg.split('=')[1] : 'codex'
        const compile = argv.includes('--compile')
        exit = await cmdBuild(scope, target, dryRun, compile)
        break
      }
      case 'import': {
        const bookId = argv[1]
        const srcDir = argv[2]
        const outArg = argv.find(a => a.startsWith('--out='))
        const outRoot = outArg ? outArg.split('=')[1] : undefined
        if (!bookId || !srcDir) {
          console.error('Usage: atheneum import <bookId> <srcDir> [--out=<dir>] [--dry-run]')
          exit = 1
        } else {
          exit = await cmdImport({
            bookId, srcDir: path.resolve(srcDir),
            outRoot: outRoot ? path.resolve(outRoot) : undefined,
            dryRun,
          })
        }
        break
      }
      case 'dev':      exit = await cmdDev(); break
      case 'stats':    exit = await cmdStats(); break
      case 'help':
      case undefined:
      default:         exit = cmdHelp(); break
    }
  } catch (err) {
    console.error('atheneum:', err instanceof Error ? err.message : err)
    exit = 2
  }
  process.exit(exit)
}

main()
