/* ─── Backend: PDF (lualatex + memoir + cookbook callouts + drop caps) ──────
   IR → LaTeX source → optional lualatex compile → PDF.

   The backend writes a self-contained .tex file per book (or per chapter for
   mini-PDFs). The actual lualatex invocation is opt-in via the `compile`
   option, so build/codex/ rendering can complete in milliseconds while
   PDF compilation (which is heavy) runs only when explicitly requested.

   Robust against missing fonts: the preamble has graceful fallbacks (EB
   Garamond → Cardo → Linux Libertine; Inter → Helvetica Neue; JetBrains
   Mono → user-fonts directory → Menlo). Build never fails on font absence.

   For chapters that contain code blocks: requires `lualatex -shell-escape`
   because minted needs Pygments via shell-out. The `compile` path passes
   that flag automatically.
───────────────────────────────────────────────────────────────────────────── */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import type { Backend, BackendOptions, BackendResult, BookInput } from './types.ts'
import { bnote } from './types.ts'
import type { Chapter } from '../../src/types/book.ts'
import type { Block } from '../../src/types/blocks.ts'
import { preamble, frontMatter, backMatter, chapterOpener } from './latex/preamble.ts'
import { renderBlock } from './latex/render.ts'

interface PdfBackendOptions extends BackendOptions {
  /** Compile the .tex via lualatex after writing? Default false. */
  compile?: boolean
  /** Shape: full book, single chapter, or mini cab-read. */
  shape?: 'book' | 'chapter' | 'mini'
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

function renderChapter(ch: Chapter): string {
  const opener = chapterOpener(ch)
  const blocks: Block[] = ch.blocks ?? []
  let isFirstBody = true
  // Skip the first H1 heading inside blocks if it duplicates the chapter title
  // (the v2 frontend emits the chapter H1 as a level-1 heading block).
  const body = blocks
    .filter((b, i) => !(i === 0 && b.type === 'heading' && b.level === 1))
    .map(b => {
      const out = renderBlock(b, { isFirstBody: isFirstBody && b.type === 'text' })
      // first text block consumes the drop-cap slot
      if (b.type === 'text') isFirstBody = false
      return out
    })
    .join('')
  return `${opener}${body}`
}

function renderBookSource(input: BookInput, opts: PdfBackendOptions): string {
  const meta = input.bookMeta as Record<string, unknown>
  const title = String(meta.title ?? input.bookId)
  const subtitle = typeof meta.subtitle === 'string' ? meta.subtitle : undefined
  const author = String(meta.author ?? 'Atheneum')
  const shape = opts.shape ?? 'book'

  const head = preamble({ bookTitle: title, bookSubtitle: subtitle, author, shape })
  const sortedChapters = [...input.chapters].sort(
    (a, b) => (a.number ?? 0) - (b.number ?? 0),
  )
  if (shape === 'chapter') {
    // Single-chapter standalone (no frontmatter, no TOC)
    const body = sortedChapters.map(renderChapter).join('\n')
    return `${head}${body}${backMatter().replace('\\backmatter\n', '')}`
  }
  if (shape === 'mini') {
    // Mini cab-read: title page + first chapter only (caller picks one)
    const body = sortedChapters.slice(0, 1).map(renderChapter).join('\n')
    return `${head}\\thispagestyle{empty}\n{\\sffamily\\Large\\bfseries ${title.replace(/[\\&%$#_{}]/g, '\\$&')}}\\par\\bigskip\n${body}\n\\end{document}\n`
  }
  // shape === 'book'
  const fm = frontMatter({ title, subtitle, author })
  const body = sortedChapters.map(renderChapter).join('\n')
  return `${head}${fm}${body}${backMatter()}`
}

async function runLuaLatex(texPath: string, cwd: string): Promise<{ ok: boolean; log: string }> {
  return await new Promise((resolve) => {
    const proc = spawn(
      'lualatex',
      ['-interaction=nonstopmode', '-shell-escape', '-halt-on-error', path.basename(texPath)],
      { cwd, env: { ...process.env, max_print_line: '1000' } },
    )
    const chunks: Buffer[] = []
    proc.stdout.on('data', d => chunks.push(d))
    proc.stderr.on('data', d => chunks.push(d))
    proc.on('close', code => {
      const log = Buffer.concat(chunks).toString('utf-8')
      resolve({ ok: code === 0, log })
    })
    proc.on('error', () => resolve({ ok: false, log: 'lualatex spawn failed' }))
  })
}

export const PdfBackend: Backend = {
  name: 'pdf',
  describe: 'lualatex + memoir + EB Garamond + minted + tcolorbox; optional compile.',
  extension: 'pdf',

  async run(input: BookInput, options: BackendOptions): Promise<BackendResult> {
    const startedAt = Date.now()
    const opts = options as PdfBackendOptions
    const bookOutDir = path.join(opts.outRoot, input.bookId)
    if (!opts.dryRun) await fs.mkdir(bookOutDir, { recursive: true })

    const tex = renderBookSource(input, opts)
    const texPath = path.join(bookOutDir, `${input.bookId}.tex`)
    const notes: BackendResult['notes'] = []
    let totalBytes = 0
    const artifacts: BackendResult['artifacts'] = []

    if (opts.dryRun) {
      const n = Buffer.byteLength(tex, 'utf-8')
      artifacts.push({ path: path.relative(opts.outRoot, texPath), bytes: n, sha256: sha256(tex) })
      totalBytes += n
    } else {
      await fs.writeFile(texPath, tex)
      const n = Buffer.byteLength(tex, 'utf-8')
      artifacts.push({ path: path.relative(opts.outRoot, texPath), bytes: n, sha256: sha256(tex) })
      totalBytes += n
    }

    if (opts.compile && !opts.dryRun) {
      // First pass — generates aux for TOC / hyperref refs.
      const r1 = await runLuaLatex(texPath, bookOutDir)
      if (!r1.ok) {
        notes.push(bnote('error', 'PDF_COMPILE_FAILED',
          `lualatex pass 1 failed. Last log lines: ${r1.log.split('\n').slice(-12).join(' | ').slice(0, 800)}`))
      } else {
        // Second pass — resolves forward refs (TOC, page numbers).
        const r2 = await runLuaLatex(texPath, bookOutDir)
        if (!r2.ok) {
          notes.push(bnote('warn', 'PDF_COMPILE_PASS2',
            `pass 2 had warnings; PDF may have unresolved refs. Tail: ${r2.log.split('\n').slice(-6).join(' | ').slice(0, 400)}`))
        }
        // Pick up the produced PDF size if present
        const pdfPath = texPath.replace(/\.tex$/, '.pdf')
        try {
          const stat = await fs.stat(pdfPath)
          artifacts.push({ path: path.relative(opts.outRoot, pdfPath), bytes: stat.size })
          totalBytes += stat.size
        } catch {
          notes.push(bnote('warn', 'PDF_NOT_PRODUCED', 'lualatex completed but no PDF found.'))
        }
      }
    } else if (opts.compile && opts.dryRun) {
      notes.push(bnote('info', 'PDF_DRYRUN_SKIPPED_COMPILE', 'Compile skipped because --dry-run is set.'))
    }

    return {
      backendName: 'pdf',
      bookId: input.bookId,
      artifacts,
      totalBytes,
      durationMs: Date.now() - startedAt,
      notes,
    }
  },
}

// Helper to render one chapter's source standalone (used by mini-PDFs).
export function renderChapterStandalone(input: BookInput, chapter: Chapter): string {
  const meta = input.bookMeta as Record<string, unknown>
  const title = String(meta.title ?? input.bookId)
  const author = String(meta.author ?? 'Atheneum')
  const head = preamble({ bookTitle: chapter.title, bookSubtitle: title, author, shape: 'chapter' })
  return `${head}${renderChapter(chapter)}\\end{document}\n`
}
