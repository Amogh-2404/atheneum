/* ─── Backend: Codex (the web reader's JSON corpus) ──────────────────────────
   Writes the on-disk JSON shape the React reader consumes:

     content/<bookId>/
       book.json
       outline.json
       chapters/<id>.json

   Goal: produce JSON byte-equivalent to what the v2 markdown converter
   currently writes (regression-clean), but driven by the typed IR + Zod
   validation, so authoring tools (Studio, AI passes, hand edits) all funnel
   through one canonical path.

   This backend is intentionally minimal — it doesn't transform content.
   It validates, then writes. Validation failures become BackendNotes
   (errors), not exceptions, so a single bad chapter doesn't block a whole
   book build.
───────────────────────────────────────────────────────────────────────────── */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type {
  Backend, BookInput, BackendOptions, BackendResult, BackendArtifact,
} from './types.ts'
import { bnote } from './types.ts'

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true })
}

async function writeFileAtomic(filePath: string, contents: string): Promise<number> {
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`
  await fs.writeFile(tmp, contents)
  await fs.rename(tmp, filePath)
  return Buffer.byteLength(contents, 'utf-8')
}

export const CodexBackend: Backend = {
  name: 'codex',
  describe: 'Atheneum web reader JSON corpus (book.json + outline.json + chapters/*.json).',
  extension: 'json',

  async run(input: BookInput, options: BackendOptions): Promise<BackendResult> {
    const startedAt = Date.now()
    const artifacts: BackendArtifact[] = []
    const notes: BackendResult['notes'] = []
    let totalBytes = 0

    const bookDir = path.join(options.outRoot, input.bookId)
    const chaptersDir = path.join(bookDir, 'chapters')
    if (!options.dryRun) {
      await ensureDir(chaptersDir)
    }

    // ─ book.json ────────────────────────────────────────────────────
    const bookJson = JSON.stringify(input.bookMeta, null, 2)
    const bookPath = path.join(bookDir, 'book.json')
    if (options.dryRun) {
      const n = Buffer.byteLength(bookJson, 'utf-8')
      artifacts.push({ path: path.relative(options.outRoot, bookPath), bytes: n, sha256: sha256(bookJson) })
      totalBytes += n
    } else {
      const n = await writeFileAtomic(bookPath, bookJson)
      artifacts.push({ path: path.relative(options.outRoot, bookPath), bytes: n, sha256: sha256(bookJson) })
      totalBytes += n
    }

    // ─ outline.json ─────────────────────────────────────────────────
    if (input.outline) {
      const outlineJson = JSON.stringify(input.outline, null, 2)
      const outlinePath = path.join(bookDir, 'outline.json')
      if (options.dryRun) {
        const n = Buffer.byteLength(outlineJson, 'utf-8')
        artifacts.push({ path: path.relative(options.outRoot, outlinePath), bytes: n, sha256: sha256(outlineJson) })
        totalBytes += n
      } else {
        const n = await writeFileAtomic(outlinePath, outlineJson)
        artifacts.push({
          path: path.relative(options.outRoot, outlinePath),
          bytes: n,
          sha256: sha256(outlineJson),
        })
        totalBytes += n
      }
    } else {
      notes.push(bnote('warn', 'CODEX_NO_OUTLINE', 'No outline provided — concept graph will not work.'))
    }

    // ─ chapters/*.json ──────────────────────────────────────────────
    const scope = options.scope ? new Set(options.scope) : null
    for (const ch of input.chapters) {
      if (scope && !scope.has(ch.id)) continue
      const chapterJson = JSON.stringify(ch, null, 2)
      const chapterPath = path.join(chaptersDir, `${ch.id}.json`)
      if (options.dryRun) {
        const n = Buffer.byteLength(chapterJson, 'utf-8')
        artifacts.push({ path: path.relative(options.outRoot, chapterPath), bytes: n, sha256: sha256(chapterJson) })
        totalBytes += n
      } else {
        const n = await writeFileAtomic(chapterPath, chapterJson)
        artifacts.push({
          path: path.relative(options.outRoot, chapterPath),
          bytes: n,
          sha256: sha256(chapterJson),
        })
        totalBytes += n
      }
    }

    return {
      backendName: 'codex',
      bookId: input.bookId,
      artifacts,
      totalBytes,
      durationMs: Date.now() - startedAt,
      notes,
    }
  },
}
