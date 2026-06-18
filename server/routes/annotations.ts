import { Hono } from 'hono'
import { sanitizeId } from '../utils.js'
import { getAnnotations, getConfusionAnnotations, syncAnnotations, deleteAnnotation } from '../lib/db.js'

export const annotationsRouter = new Hono()

// ─── GET /:bookId → All annotations for a book ──────────────────
annotationsRouter.get('/:bookId', (c) => {
  const bookId = sanitizeId(c.req.param('bookId'))
  if (!bookId) return c.json({ error: 'invalid bookId' }, 400)
  return c.json({ annotations: getAnnotations(bookId) })
})

// ─── GET /:bookId/confusion → Confusion markers only ────────────
annotationsRouter.get('/:bookId/confusion', (c) => {
  const bookId = sanitizeId(c.req.param('bookId'))
  if (!bookId) return c.json({ error: 'invalid bookId' }, 400)
  return c.json({ annotations: getConfusionAnnotations(bookId) })
})

// ─── POST /:bookId → Create or sync annotations (merge by id) ────
annotationsRouter.post('/:bookId', async (c) => {
  const bookId = sanitizeId(c.req.param('bookId'))
  if (!bookId) return c.json({ error: 'invalid bookId' }, 400)

  let body: { annotations?: any[] }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid JSON' }, 400)
  }

  if (!Array.isArray(body.annotations)) {
    return c.json({ error: 'annotations must be an array' }, 400)
  }

  try {
    const total = syncAnnotations(bookId, body.annotations)
    return c.json({ synced: body.annotations.length, total })
  } catch (e) {
    console.error('[annotations] sync failed:', (e as Error).message)
    return c.json({ error: 'failed to sync annotations' }, 500)
  }
})

// ─── DELETE /:bookId/:annotationId → Remove one annotation ──────
annotationsRouter.delete('/:bookId/:annotationId', async (c) => {
  const bookId = sanitizeId(c.req.param('bookId'))
  if (!bookId) return c.json({ error: 'invalid bookId' }, 400)

  const annotationId = c.req.param('annotationId')
  if (!annotationId) return c.json({ error: 'missing annotationId' }, 400)

  try {
    if (!deleteAnnotation(bookId, annotationId)) {
      return c.json({ error: 'not found' }, 404)
    }
    return c.json({ removed: 1 })
  } catch (e) {
    console.error('[annotations] delete failed:', (e as Error).message)
    return c.json({ error: 'failed to delete annotation' }, 500)
  }
})
