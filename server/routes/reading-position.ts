import { Hono } from 'hono'
import { sanitizeId } from '../utils.js'
import { getReadingPosition, saveReadingPosition } from '../lib/db.js'

export const readingPositionRouter = new Hono()

// ─── GET /:bookId → Get reading position ────────────────────────
readingPositionRouter.get('/:bookId', (c) => {
  const bookId = sanitizeId(c.req.param('bookId'))
  if (!bookId) return c.json({ error: 'invalid bookId' }, 400)
  return c.json({ position: getReadingPosition(bookId) })
})

// ─── POST / → Save reading position (atomic upsert; was a raw non-atomic write) ──
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

  const bookId = sanitizeId(body.bookId)
  if (!bookId) return c.json({ error: 'invalid bookId' }, 400)

  try {
    saveReadingPosition({
      bookId,
      chapterId: body.chapterId,
      scrollPercent: body.scrollPercent,
      timestamp: body.timestamp || new Date().toISOString(),
    })
    return c.json({ saved: true })
  } catch (e) {
    console.error('[reading-position] save failed:', (e as Error).message)
    return c.json({ error: 'failed to save position' }, 500)
  }
})
