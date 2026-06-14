import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, renameSync, openSync, fsyncSync, closeSync } from 'fs'
import path from 'path'
import lockfile from 'proper-lockfile'

const LOCK_OPTIONS = {
  retries: { retries: 5, factor: 2, minTimeout: 100, maxTimeout: 2000 },
  stale: 10000, // auto-release after 10s
  realpath: false,
}

/**
 * Atomically write `contents` to `filePath` via a sibling temp file + fsync +
 * rename (atomic on the same filesystem). Mirrors server/lib/write-gate.ts and
 * server/backends/codex.ts. MUST be called while holding the file's lock.
 * A plain in-place writeFileSync truncates then rewrites, so a crash mid-write
 * leaves a torn / zero-length file that then fails JSON.parse on read.
 */
function atomicWrite(filePath: string, contents: string): void {
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`
  try {
    const fd = openSync(tmp, 'w')
    try {
      writeFileSync(fd, contents, 'utf-8')
      fsyncSync(fd)
    } finally {
      closeSync(fd)
    }
    renameSync(tmp, filePath)
  } catch (err) {
    try { if (existsSync(tmp)) unlinkSync(tmp) } catch { /* best effort */ }
    throw err
  }
}

/**
 * Safely read a JSON file. Returns null if file doesn't exist.
 * Retries once on parse error (handles race with in-progress write).
 */
export async function safeReadJSON(filePath: string): Promise<any | null> {
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch {
    // Brief retry for race with in-progress write
    await new Promise(r => setTimeout(r, 100))
    try {
      return JSON.parse(readFileSync(filePath, 'utf-8'))
    } catch {
      return null
    }
  }
}

/**
 * Safely write a JSON file with OS-level file locking.
 * Uses a mutate function that receives current data (or null for new files)
 * and returns the new data. Read-inside-lock prevents race conditions.
 *
 * The MCP server does NOT call scheduleCommit — the Hono watcher handles git.
 */
export async function safeWriteJSON(
  filePath: string,
  mutateFn: (current: any | null) => any,
): Promise<any> {
  const dir = path.dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  // For new files, create an empty file so proper-lockfile has something to lock
  if (!existsSync(filePath)) {
    writeFileSync(filePath, '{}', 'utf-8')
  }

  const release = await lockfile.lock(filePath, LOCK_OPTIONS)
  try {
    const current = JSON.parse(readFileSync(filePath, 'utf-8'))
    const updated = mutateFn(current)
    atomicWrite(filePath, JSON.stringify(updated, null, 2) + '\n')
    return updated
  } finally {
    await release()
  }
}

/**
 * Safely write a JSON file directly (no mutate pattern).
 * For cases where you have the complete data and don't need to read first.
 */
export async function safeWriteJSONDirect(
  filePath: string,
  data: any,
): Promise<void> {
  const dir = path.dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  if (!existsSync(filePath)) {
    writeFileSync(filePath, '{}', 'utf-8')
  }

  const release = await lockfile.lock(filePath, LOCK_OPTIONS)
  try {
    atomicWrite(filePath, JSON.stringify(data, null, 2) + '\n')
  } finally {
    await release()
  }
}

/**
 * Safely delete a file.
 */
export function safeDeleteFile(filePath: string): boolean {
  if (!existsSync(filePath)) return false
  unlinkSync(filePath)
  return true
}
