/* ─── Atheneum Backend Framework ─────────────────────────────────────────────
   Same shape as LLVM target backends. A backend is a pure transformation
   from validated IR to a target artifact (filesystem, in-memory blob,
   stream).

     interface Backend {
       name: string                // "codex" | "pdf" | "epub" | "anki" | "audio"
       describe: string
       extension?: string          // "json" | "pdf" | "epub" | ...
       run(book: BookInput): Promise<BackendResult>
     }

   Composability:
     - Backends consume the same IR every other backend reads. Adding a new
       backend = adding one file. No backend-specific block types — if you
       need new structure, the IR grows (and every other backend gets it
       for free).
     - All I/O lives in the backend. Lint and Pass layers stay pure.
     - Backends emit a `BackendResult` describing what they wrote so the
       orchestrator can summarize, hash, ship, etc.

   Naming: the canonical web-reader backend is `CodexBackend` (since the
   product surface is ATHENEUM, but the underlying repo dir is `the-codex`).
   The PDF backend is `PdfBackend`. The EPUB backend is `EpubBackend`. Etc.
───────────────────────────────────────────────────────────────────────────── */

import type { Chapter } from '../../src/types/book.ts'

export interface BookInput {
  bookId: string
  /** Book metadata (book.json shape, validated upstream). */
  bookMeta: Record<string, unknown>
  /** Outline (concept index, prereqs, etc.). */
  outline: Record<string, unknown> | null
  /** Validated chapters. */
  chapters: Chapter[]
}

export interface BackendArtifact {
  /** Path relative to the backend's output root (or absolute). */
  path: string
  /** Bytes written (for the manifest + size budgets). */
  bytes: number
  /** Optional content hash so CI can diff against a baseline. */
  sha256?: string
}

export interface BackendResult {
  backendName: string
  bookId: string
  artifacts: BackendArtifact[]
  /** Total bytes across all artifacts. */
  totalBytes: number
  /** Wall-clock duration in milliseconds. */
  durationMs: number
  /** Optional notes — same shape as lint issues. */
  notes: Array<{
    severity: 'info' | 'warn' | 'error'
    code: string
    msg: string
    chapterId?: string
  }>
}

export interface BackendOptions {
  /** Output root directory. Backend resolves artifact paths relative to it. */
  outRoot: string
  /** If set, do not actually write — return the result with bytes=size only. */
  dryRun?: boolean
  /** Optional subset of chapter ids to process (for incremental rebuilds). */
  scope?: string[]
}

export interface Backend {
  name: string
  describe: string
  extension?: string
  run(input: BookInput, options: BackendOptions): Promise<BackendResult>
}

/** Helper for backends to clamp their notes. */
export function bnote(
  severity: 'info' | 'warn' | 'error',
  code: string,
  msg: string,
  chapterId?: string,
) {
  return { severity, code, msg, ...(chapterId ? { chapterId } : {}) }
}
