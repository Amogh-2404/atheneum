import { Hono } from 'hono'
import { sanitizeId } from '../utils.js'
import { getStruggle, saveStruggle } from '../lib/db.js'

export const struggleRouter = new Hono()

// Derived per-block struggle score, fused from reading telemetry. Now in SQLite
// (was a .state/ JSON file the Forge read from disk). Reading surface never shows it.
struggleRouter.get('/:bookId', (c) => {
  const bookId = sanitizeId(c.req.param('bookId'))
  if (!bookId) return c.json({ error: 'invalid bookId' }, 400)
  return c.json({ struggle: getStruggle(bookId) })
})

struggleRouter.post('/:bookId', async (c) => {
  const bookId = sanitizeId(c.req.param('bookId'))
  if (!bookId) return c.json({ error: 'invalid bookId' }, 400)

  let body: any
  try { body = await c.req.json() } catch { return c.json({ error: 'invalid JSON' }, 400) }
  if (!body || !Array.isArray(body.blocks)) return c.json({ error: 'missing blocks' }, 400)

  try {
    saveStruggle(bookId, body)
    return c.json({ ok: true })
  } catch (e) {
    console.error('[struggle] save failed:', (e as Error).message)
    return c.json({ error: 'failed to save struggle' }, 500)
  }
})
