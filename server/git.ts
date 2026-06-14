/// <reference path="./proper-lockfile-shim.d.ts" />
import { execSync } from 'child_process'
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

export function scheduleCommit(contentDir: string, filePath: string, description: string) {
  pendingFiles.add(filePath)
  pendingDescription = description  // last description wins for single-file, multi-file gets generic msg

  if (commitTimer) clearTimeout(commitTimer)

  // Batch commits: wait 2s after last change before committing
  commitTimer = setTimeout(() => {
    try {
      for (const f of pendingFiles) {
        execSync(`git add "${f}"`, { cwd: contentDir, stdio: 'ignore' })
      }

      // Check if there are actually staged changes
      try {
        execSync('git diff --cached --quiet', { cwd: contentDir, stdio: 'ignore' })
        // If the above succeeds, nothing is staged — skip commit
        console.log('[git] No changes to commit')
        pendingFiles.clear()
        pendingDescription = ''
        return
      } catch {
        // diff --cached --quiet exits 1 when there ARE changes — proceed
      }

      const message = pendingFiles.size === 1
        ? `[atheneum] ${pendingDescription}`
        : `[atheneum] Updated ${pendingFiles.size} files`

      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: contentDir,
        stdio: 'ignore',
      })
      console.log(`[git] Committed: ${message}`)
    } catch (e: any) {
      if (!e.message?.includes('nothing to commit')) {
        console.error('[git] Commit failed:', e.message)
      }
    }
    pendingFiles.clear()
    pendingDescription = ''
  }, 2000)
}
