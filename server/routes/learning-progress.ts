import { Hono } from 'hono'
import { sanitizeId } from '../utils.js'
import { getLearningProgress, saveLearningProgress } from '../lib/db.js'

export const learningProgressRouter = new Hono()

// ─── GET /:bookId → Get learning progress ────────────────────────────
learningProgressRouter.get('/:bookId', (c) => {
  const bookId = sanitizeId(c.req.param('bookId'))
  if (!bookId) return c.json({ error: 'invalid bookId' }, 400)
  return c.json({ progress: getLearningProgress(bookId) })
})

// ─── POST /:bookId → Save learning progress (staleness-guarded) ──────
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

  const bookId = sanitizeId(body.bookId)
  if (!bookId) return c.json({ error: 'invalid bookId' }, 400)

  try {
    // saveLearningProgress returns false (and writes nothing) if the stored copy is newer.
    if (!saveLearningProgress(bookId, body)) {
      return c.json({ saved: false, reason: 'server is newer' })
    }
    return c.json({ saved: true })
  } catch (e) {
    console.error('[learning-progress] save failed:', (e as Error).message)
    return c.json({ error: 'failed to save progress' }, 500)
  }
})
