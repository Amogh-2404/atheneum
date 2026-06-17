import { Hono } from 'hono'
import { existsSync, readFileSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { sanitizeId, safePath } from '../utils.js'
import { withFileLock } from '../git.js'
import { atomicWriteJSON } from '../lib/write-gate.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CONTENT_DIR = path.join(__dirname, '..', '..', 'content')

export const struggleRouter = new Hono()

// Derived per-block struggle score, fused from reading telemetry. Lives in
// .state/ (the Forge reads it from disk). Reading surface never shows it.
function getStatePath(bookId: string): string | null {
  const clean = sanitizeId(bookId)
  if (!clean) return null
  const dir = safePath(CONTENT_DIR, clean, '.state')
  if (!dir) return null
  return path.join(dir, 'struggle.json')
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

interface Acc { dwellMs: number; revisits: number; expectedMs: number; obs: number }

function scoreBlock(b: Acc) {
  const revisitScore = Math.min(b.revisits / 3, 1)
  const dwellScore = b.expectedMs > 0 ? Math.max(0, Math.min(1, (b.dwellMs / b.expectedMs - 1) / 2)) : 0
  // No confusion/quiz fusion here yet — the Forge reads those signals directly.
  const score = Math.round((0.6 * revisitScore + 0.4 * dwellScore) * 100) / 100
  const topSignal = revisitScore === 0 && dwellScore === 0 ? 'none' : revisitScore >= dwellScore ? 'reread' : 'dwell'
  const confidence = Math.min(b.obs / 3, 1)
  return { ...b, score, confidence, topSignal }
}

struggleRouter.get('/:bookId', (c) => {
  const filePath = getStatePath(c.req.param('bookId'))
  if (!filePath) return c.json({ error: 'invalid bookId' }, 400)
  if (!existsSync(filePath)) return c.json({ struggle: null })
  try {
    return c.json({ struggle: JSON.parse(readFileSync(filePath, 'utf-8')) })
  } catch {
    return c.json({ struggle: null })
  }
})

struggleRouter.post('/:bookId', async (c) => {
  const bookId = c.req.param('bookId')
  const filePath = getStatePath(bookId)
  if (!filePath) return c.json({ error: 'invalid bookId' }, 400)
  let body: any
  try { body = await c.req.json() } catch { return c.json({ error: 'invalid JSON' }, 400) }
  if (!body || !Array.isArray(body.blocks)) return c.json({ error: 'missing blocks' }, 400)

  try {
    await withFileLock(filePath, async () => {
      ensureDir(filePath)
      let map: any = { bookId, chapters: {}, wpm: 0, updatedAt: new Date(0).toISOString() }
      if (existsSync(filePath)) {
        try { map = JSON.parse(readFileSync(filePath, 'utf-8')) } catch { /* overwrite if corrupt */ }
      }
      if (!map.chapters) map.chapters = {}
      map.bookId = bookId
      if (typeof body.wpm === 'number' && body.wpm > 0) map.wpm = Math.round(body.wpm)
      const chId = String(body.chapterId || '')
      if (!map.chapters[chId]) map.chapters[chId] = {}
      const ch = map.chapters[chId]
      for (const d of body.blocks) {
        if (!d || typeof d.blockId !== 'string') continue
        const prev: Acc = ch[d.blockId] || { dwellMs: 0, revisits: 0, expectedMs: 0, obs: 0 }
        const merged: Acc = {
          dwellMs: prev.dwellMs + Math.max(0, Math.min(180000, Number(d.dwellMs) || 0)),
          revisits: prev.revisits + Math.max(0, Number(d.revisits) || 0),
          expectedMs: Number(d.expectedMs) || prev.expectedMs || 0,
          obs: prev.obs + 1,
        }
        ch[d.blockId] = scoreBlock(merged)
      }
      map.updatedAt = new Date().toISOString()
      atomicWriteJSON(filePath, map)
    })
    return c.json({ ok: true })
  } catch (e) {
    console.error('[struggle] save failed:', (e as Error).message)
    return c.json({ error: 'failed to save struggle' }, 500)
  }
})
