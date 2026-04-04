import { Hono } from 'hono'
import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import { sanitizeId, safePath } from '../utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONTENT_DIR = path.join(__dirname, '..', '..', 'content')

// Mounted at /api/books/:bookId/chapters/:chapterId/history
export const historyRouter = new Hono()

// ─── Helper: resolve chapter file path ────────────────────────────
function resolveChapterPath(c: any): { filePath: string; relPath: string } | null {
  const bookId = sanitizeId(c.req.param('bookId'))
  const chapterId = sanitizeId(c.req.param('chapterId'))
  if (!bookId || !chapterId) return null

  const filePath = safePath(CONTENT_DIR, bookId, 'chapters', `${chapterId}.json`)
  if (!filePath) return null

  // Relative path from content dir for git commands
  const relPath = path.relative(CONTENT_DIR, filePath)
  return { filePath, relPath }
}

// Sanitize a git hash — must be hex only
function sanitizeHash(hash: string): string | null {
  if (!hash || typeof hash !== 'string') return null
  const clean = hash.replace(/[^a-fA-F0-9]/g, '')
  if (!clean || clean !== hash || clean.length < 7 || clean.length > 40) return null
  return clean
}

// ─── GET / → Commit history for a chapter ─────────────────────────
historyRouter.get('/', (c) => {
  const resolved = resolveChapterPath(c)
  if (!resolved) return c.json({ error: 'invalid bookId or chapterId' }, 400)

  if (!existsSync(resolved.filePath)) {
    return c.json({ error: 'chapter not found' }, 404)
  }

  try {
    const raw = execSync(
      `git log --format="%H|%s|%ai" -- "${resolved.relPath}"`,
      { cwd: CONTENT_DIR, encoding: 'utf-8', timeout: 5000 }
    ).trim()

    if (!raw) {
      return c.json({ commits: [] })
    }

    const commits = raw.split('\n').map((line) => {
      const [hash, ...rest] = line.split('|')
      // Message may contain pipes, so rejoin everything except first and last
      const datePart = rest.pop() ?? ''
      const message = rest.join('|')
      return {
        hash: hash.trim(),
        message: message.trim(),
        date: datePart.trim(),
      }
    })

    return c.json({ commits })
  } catch (e: any) {
    console.error('[history] git log failed:', e.message)
    return c.json({ commits: [] })
  }
})

// ─── GET /:hash → Chapter content at a specific commit ────────────
historyRouter.get('/:hash', (c) => {
  const resolved = resolveChapterPath(c)
  if (!resolved) return c.json({ error: 'invalid bookId or chapterId' }, 400)

  const hash = sanitizeHash(c.req.param('hash'))
  if (!hash) return c.json({ error: 'invalid hash' }, 400)

  try {
    const content = execSync(
      `git show ${hash}:"${resolved.relPath}"`,
      { cwd: CONTENT_DIR, encoding: 'utf-8', timeout: 5000 }
    )

    const parsed = JSON.parse(content)
    return c.json(parsed)
  } catch (e: any) {
    console.error('[history] git show failed:', e.message)
    return c.json({ error: 'version not found' }, 404)
  }
})

// ─── POST /revert/:hash → Revert chapter to a specific commit ─────
historyRouter.post('/revert/:hash', async (c) => {
  const resolved = resolveChapterPath(c)
  if (!resolved) return c.json({ error: 'invalid bookId or chapterId' }, 400)

  const hash = sanitizeHash(c.req.param('hash'))
  if (!hash) return c.json({ error: 'invalid hash' }, 400)

  if (!existsSync(resolved.filePath)) {
    return c.json({ error: 'chapter not found' }, 404)
  }

  try {
    // Checkout the file at the specified commit
    execSync(
      `git checkout ${hash} -- "${resolved.relPath}"`,
      { cwd: CONTENT_DIR, encoding: 'utf-8', timeout: 5000 }
    )

    // Commit the revert
    execSync(
      `git commit -m "[atheneum] Revert chapter to ${hash.slice(0, 7)}"`,
      { cwd: CONTENT_DIR, encoding: 'utf-8', timeout: 5000 }
    )

    console.log(`[history] Reverted ${resolved.relPath} to ${hash.slice(0, 7)}`)
    return c.json({ reverted: true })
  } catch (e: any) {
    console.error('[history] revert failed:', e.message)
    return c.json({ error: 'revert failed' }, 500)
  }
})
