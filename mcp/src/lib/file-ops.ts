import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'
import path from 'path'
import lockfile from 'proper-lockfile'

const LOCK_OPTIONS = {
  retries: { retries: 5, factor: 2, minTimeout: 100, maxTimeout: 2000 },
  stale: 10000, // auto-release after 10s
  realpath: false,
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
    writeFileSync(filePath, JSON.stringify(updated, null, 2) + '\n', 'utf-8')
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
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
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
