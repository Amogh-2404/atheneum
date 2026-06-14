import { Hono } from 'hono'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { sanitizeId, safePath } from '../utils.js'
import { withFileLock } from '../git.js'
import { atomicWriteJSON } from '../lib/write-gate.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONTENT_DIR = path.join(__dirname, '..', '..', 'content')

export const learningProgressRouter = new Hono()

function getStatePath(bookId: string): string | null {
  const clean = sanitizeId(bookId)
  if (!clean) return null
  const dir = safePath(CONTENT_DIR, clean, '.state')
  if (!dir) return null
  return path.join(dir, 'learning-progress.json')
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

// ─── GET /:bookId → Get learning progress ────────────────────────────
learningProgressRouter.get('/:bookId', (c) => {
  const filePath = getStatePath(c.req.param('bookId'))
  if (!filePath) return c.json({ error: 'invalid bookId' }, 400)

  if (!existsSync(filePath)) {
    return c.json({ progress: null })
  }

  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'))
    return c.json({ progress: data })
  } catch {
    return c.json({ progress: null })
  }
})

// ─── POST /:bookId → Save learning progress ─────────────────────────
learningProgressRouter.post('/:bookId', async (c) => {
  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid JSON' }, 400)
  }

  if (!body.bookId) {
    return c.json({ error: 'missing bookId in body' }, 400)
  }

  const filePath = getStatePath(body.bookId)
  if (!filePath) return c.json({ error: 'invalid bookId' }, 400)

  try {
    ensureDir(filePath)

    // Read the staleness guard AND write inside one lock, so the newer-than
    // check and the write are atomic against a racing save. Behaviour is
    // unchanged: if the server copy is newer, skip the write.
    const saved = await withFileLock(filePath, async () => {
      // Merge: if server has newer data, keep server's
      if (existsSync(filePath)) {
        try {
          const existing = JSON.parse(readFileSync(filePath, 'utf-8'))
          if (existing.updatedAt && body.updatedAt && existing.updatedAt > body.updatedAt) {
            return false
          }
        } catch { /* overwrite if corrupt */ }
      }

      atomicWriteJSON(filePath, body)
      return true
    })

    if (!saved) {
      return c.json({ saved: false, reason: 'server is newer' })
    }
    return c.json({ saved: true })
  } catch (e) {
    console.error('[learning-progress] save failed:', (e as Error).message)
    return c.json({ error: 'failed to save progress' }, 500)
  }
})
