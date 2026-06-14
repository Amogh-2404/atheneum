import { existsSync, readFileSync, writeFileSync } from 'fs'
import { withFileLock } from '../git.js'
import { validateChapter } from '../validator.js'

/**
 * The single validated write choke point for chapter JSON.
 *
 * Acquires the same per-file OS lock every other chapter writer uses, reads the
 * current chapter inside the lock, applies the mutate function, then runs the
 * STRICT chapter validator on the result. The file is only ever rewritten when
 * validation passes. On failure it throws — with the exact Zod issue paths in
 * the message (e.g. "blocks.7.correctIndex: Required") — and the file is left
 * byte-identical to what it was before the lock was taken.
 *
 * Mirrors the ergonomics of safeWriteJSON (mcp/src/lib/file-ops.ts): same
 * (filePath, mutateFn) signature, read-inside-lock, JSON + trailing newline.
 * The difference is the strict gate between mutate and write.
 *
 * Strict validation here is intentional — this is the WRITE path. Read-time
 * display keeps using validateChapterGraceful so the 14k legacy blocks never
 * brick on render. Only chapter files should go through this gate; sidecar
 * files (annotations, reading-position, outline) have no ChapterSchema and must
 * use a plain locked writer instead.
 */
export async function validatedWrite(
  chapterPath: string,
  mutateFn: (current: any | null) => any,
): Promise<any> {
  return withFileLock(chapterPath, async () => {
    const current = existsSync(chapterPath)
      ? JSON.parse(readFileSync(chapterPath, 'utf-8'))
      : null

    const next = mutateFn(current)

    const result = validateChapter(next)
    if (!result.success) {
      // Surface the exact "blocks.N.field: message" paths so the caller (the
      // MCP tool's catch) can hand them straight back to the AI author. Cap at
      // 8 to keep the message readable when a chapter is badly malformed.
      const issues = (result.errors ?? []).slice(0, 8).join('; ')
      throw new Error(
        `write-gate: refused to persist malformed chapter ${chapterPath}: ${issues}`,
      )
    }

    writeFileSync(chapterPath, JSON.stringify(next, null, 2) + '\n', 'utf-8')
    return next
  })
}
