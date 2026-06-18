/// <reference path="./proper-lockfile-shim.d.ts" />
import { execFileSync } from 'child_process'
import lockfile from 'proper-lockfile'
import { existsSync, writeFileSync, mkdirSync } from 'fs'
import path from 'path'

/* ─── Per-file OS-level lock (cross-process safe) ─────────────────── */

export async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  // Ensure parent directory and file exist for lockfile
  const dir = path.dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  if (!existsSync(filePath)) writeFileSync(filePath, '{}', 'utf-8')

  const release = await lockfile.lock(filePath, {
    retries: { retries: 5, factor: 2, minTimeout: 100, maxTimeout: 2000 },
    stale: 10000,
    realpath: false,
  })
  try {
    return await fn()
  } finally {
    await release()
  }
}

/* ─── Batched git commits ─────────────────────────────────────────── */
let commitTimer: ReturnType<typeof setTimeout> | null = null
let pendingFiles: Set<string> = new Set()
let pendingDescription: string = ''
let firstPendingAt = 0
const DEBOUNCE_MS = 2000
const MAX_WAIT_MS = 15000 // commit at least this often under a continuous change stream

export function scheduleCommit(contentDir: string, filePath: string, description: string) {
  pendingFiles.add(filePath)
  pendingDescription = description  // last description wins for single-file, multi-file gets generic msg
  if (!firstPendingAt) firstPendingAt = Date.now()

  if (commitTimer) clearTimeout(commitTimer)
  // Debounce 2s after the last change, but cap the total wait: a daemon seeding a whole
  // book back-to-back faster than 2s would otherwise keep pushing the timer forever.
  const wait = Math.min(DEBOUNCE_MS, Math.max(0, firstPendingAt + MAX_WAIT_MS - Date.now()))
  commitTimer = setTimeout(() => {
    const files = [...pendingFiles]
    const desc = pendingDescription
    pendingFiles.clear(); pendingDescription = ''; firstPendingAt = 0; commitTimer = null
    try {
      for (const f of files) {
        // argv form (execFileSync) NEVER invokes a shell, so a filename containing
        // $(...), backticks, quotes, or spaces can't inject. `-A` on an EXPLICIT
        // pathspec stages add/modify/delete for THAT path only (so deletions commit)
        // without sweeping the untracked .state/.annotations trap a bare --all would.
        execFileSync('git', ['add', '-A', '--', f], { cwd: contentDir, stdio: 'ignore' })
      }

      // diff --cached --quiet exits 1 when there ARE staged changes; 0 means nothing.
      try {
        execFileSync('git', ['diff', '--cached', '--quiet'], { cwd: contentDir, stdio: 'ignore' })
        console.log('[git] No changes to commit')
        return
      } catch { /* there ARE staged changes — proceed */ }

      const message = files.length === 1
        ? `[atheneum] ${desc}`
        : `[atheneum] Updated ${files.length} files`

      execFileSync('git', ['commit', '-m', message], { cwd: contentDir, stdio: 'ignore' })
      console.log(`[git] Committed: ${message}`)
    } catch (e: any) {
      if (!e.message?.includes('nothing to commit')) {
        console.error('[git] Commit failed:', e.message)
      }
    }
  }, wait)
}
