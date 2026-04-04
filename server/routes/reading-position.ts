import { Hono } from 'hono'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { sanitizeId, safePath } from '../utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONTENT_DIR = path.join(__dirname, '..', '..', 'content')

export const readingPositionRouter = new Hono()

function getStatePath(bookId: string): string | null {
  const clean = sanitizeId(bookId)
  if (!clean) return null
  const dir = safePath(CONTENT_DIR, clean, '.state')
  if (!dir) return null
  return path.join(dir, 'reading-position.json')
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

// ─── GET /:bookId → Get reading position ────────────────────────
readingPositionRouter.get('/:bookId', (c) => {
  const filePath = getStatePath(c.req.param('bookId'))
  if (!filePath) return c.json({ error: 'invalid bookId' }, 400)

  if (!existsSync(filePath)) {
    return c.json({ position: null })
  }

  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'))
    return c.json({ position: data })
  } catch {
    return c.json({ position: null })
  }
})

// ─── POST / → Save reading position ─────────────────────────────
readingPositionRouter.post('/', async (c) => {
  let body: { bookId?: string; chapterId?: string; scrollPercent?: number; timestamp?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid JSON' }, 400)
  }

  if (!body.bookId || !body.chapterId || body.scrollPercent == null) {
    return c.json({ error: 'missing required fields: bookId, chapterId, scrollPercent' }, 400)
  }

  const filePath = getStatePath(body.bookId)
  if (!filePath) return c.json({ error: 'invalid bookId' }, 400)

  try {
    ensureDir(filePath)
    const data = {
      bookId: body.bookId,
      chapterId: body.chapterId,
      scrollPercent: body.scrollPercent,
      timestamp: body.timestamp || new Date().toISOString(),
    }
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    return c.json({ saved: true })
  } catch (e) {
    console.error('[reading-position] save failed:', (e as Error).message)
    return c.json({ error: 'failed to save position' }, 500)
  }
})
