import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, openSync, fsyncSync, closeSync } from 'fs'
import { withFileLock } from '../git.js'
import { validateChapter } from '../validator.js'

/**
 * The single validated write choke point for chapter JSON.
 *
 * Every chapter-file writer — the MCP authoring tools AND the server HTTP
 * routes — funnels through here. It acquires the same per-file OS lock every
 * other chapter writer uses, reads the current chapter inside the lock, applies
 * the mutate function, runs the STRICT chapter validator on BOTH the current and
 * the resulting chapter, and persists only when the write introduces no NEW
 * schema errors.
 *
 * ── Why a "no-new-errors" diff and not a hard strict gate ──────────────────
 * ~7 live chapters already contain quiz/list/toggle blocks that fail the strict
 * schema (missing correctIndex/id, etc.). A naive "reject unless the whole
 * chapter is strictly valid" gate would refuse a perfectly good edit to a text
 * block in any of those chapters — the valid write is lost because of a
 * pre-existing, untouched defect elsewhere in the file. So the invariant we
 * enforce is "never make it worse": we diff the strict-validation error set of
 * `current` against `next` and reject ONLY when `next` carries an error that
 * `current` did not. A clean chapter still cannot accept any new malformed
 * block (its baseline error set is empty, so ANY new error is rejected) — that
 * is exactly the "AI author can never persist a malformed block" guarantee. The
 * legacy-imperfect chapters become editable again without ever letting their
 * defects spread. Once fix-invalid-chapters.ts has cleaned the 7, the baseline
 * is empty everywhere and the gate is effectively fully strict.
 *
 * ── Atomicity ──────────────────────────────────────────────────────────────
 * The write itself is temp-file + rename (mirrors server/backends/codex.ts).
 * A plain in-place writeFileSync truncates then rewrites, so a crash / kill /
 * ENOSPC mid-write leaves a torn or zero-length chapter on disk that then 500s
 * on read (reads use validateChapterGraceful, which is advisory and never
 * blocks). Writing to `${path}.tmp.<pid>.<ts>`, fsync-ing it, then renameSync
 * onto the target (atomic on the same filesystem) guarantees a reader sees
 * either the old whole file or the new whole file — never a half-written one.
 *
 * Read-time display keeps using validateChapterGraceful so the 14k legacy
 * blocks never brick on render. Only chapter files should go through this gate;
 * sidecar files (annotations, reading-position, outline) have no ChapterSchema
 * and must use a plain locked writer instead.
 */

/** Strict-validate `data`; return the SET of "path: message" error strings (empty == valid). */
function chapterErrorSet(data: unknown): Set<string> {
  const result = validateChapter(data)
  if (result.success) return new Set()
  return new Set(result.errors ?? [])
}

/**
 * Core gate: throw if `next` carries any strict-schema error that is not in the
 * precomputed `baseline` error set.
 *
 * Taking the baseline as an ALREADY-COMPUTED set (not a `current` object) is
 * deliberate and load-bearing: several callers (the MCP tools) mutate `current`
 * in place and return that same object as `next`, so by the time we want to
 * validate, `current` and `next` are the same reference and re-deriving the
 * baseline from it would always match `next` → the diff would be empty and the
 * gate would wave every malformed write through. Callers MUST snapshot the
 * baseline from the pristine on-disk chapter BEFORE running their mutate.
 */
function assertAgainstBaseline(baseline: Set<string>, next: unknown, chapterPath: string): void {
  const nextErrors = chapterErrorSet(next)

  const introduced: string[] = []
  for (const err of nextErrors) {
    if (!baseline.has(err)) introduced.push(err)
  }

  if (introduced.length > 0) {
    // Surface the exact "blocks.N.field: message" paths so the caller can hand
    // them straight back to the AI author. Cap at 8 to keep the message
    // readable when a write is badly malformed.
    const issues = introduced.slice(0, 8).join('; ')
    throw new Error(
      `write-gate: refused to persist malformed chapter ${chapterPath}: introduces ${introduced.length} new schema error(s): ${issues}`,
    )
  }
}

/**
 * Gate the transition current → next. Throws if `next` introduces strict-schema
 * errors that `current` did not already have. Exported for the server routes,
 * which already hold their own lock (so cannot nest withFileLock) and which
 * build `next` as a FRESH object without mutating `current` — so deriving the
 * baseline from `current` here is safe. (The MCP path uses validatedWrite, which
 * snapshots the baseline before its in-place mutate; see assertAgainstBaseline.)
 */
export function assertNoNewErrors(current: unknown | null, next: unknown, chapterPath: string): void {
  const baseline = current == null ? new Set<string>() : chapterErrorSet(current)
  assertAgainstBaseline(baseline, next, chapterPath)
}

/**
 * Atomically write `data` (pretty JSON + trailing newline) to `filePath` via a
 * sibling temp file + fsync + rename. MUST be called while holding the file's
 * lock. Exported so the locked server routes can persist atomically too.
 */
export function atomicWriteJSON(filePath: string, data: unknown): void {
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`
  const contents = JSON.stringify(data, null, 2) + '\n'
  try {
    const fd = openSync(tmp, 'w')
    try {
      writeFileSync(fd, contents, 'utf-8')
      fsyncSync(fd) // durability: flush the tmp file before the rename publishes it
    } finally {
      closeSync(fd)
    }
    renameSync(tmp, filePath) // atomic on the same filesystem
  } catch (err) {
    // Never leave a stray temp file behind on failure.
    try { if (existsSync(tmp)) unlinkSync(tmp) } catch { /* best effort */ }
    throw err
  }
}

/**
 * Mirrors the ergonomics of safeWriteJSON (mcp/src/lib/file-ops.ts): same
 * (filePath, mutateFn) signature, read-inside-lock, JSON + trailing newline.
 * The difference is the strict no-new-errors gate between mutate and write, and
 * the atomic temp+rename persistence.
 */
export async function validatedWrite(
  chapterPath: string,
  mutateFn: (current: any | null) => any,
): Promise<any> {
  return withFileLock(chapterPath, async () => {
    const current = existsSync(chapterPath)
      ? JSON.parse(readFileSync(chapterPath, 'utf-8'))
      : null

    // Snapshot the baseline error set from the PRISTINE chapter BEFORE running
    // mutate — mutate may edit `current` in place and return it as `next`, which
    // would make a post-mutate baseline identical to next and defeat the diff.
    const baseline = current == null ? new Set<string>() : chapterErrorSet(current)

    const next = mutateFn(current)

    assertAgainstBaseline(baseline, next, chapterPath)
    atomicWriteJSON(chapterPath, next)
    return next
  })
}
