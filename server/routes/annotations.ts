import { Hono } from 'hono'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { sanitizeId, safePath } from '../utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONTENT_DIR = path.join(__dirname, '..', '..', 'content')

export const annotationsRouter = new Hono()

function getAnnotationsPath(bookId: string): string | null {
  const clean = sanitizeId(bookId)
  if (!clean) return null
  const dir = safePath(CONTENT_DIR, clean, '.annotations')
  if (!dir) return null
  return path.join(dir, 'annotations.json')
}

function ensureDir(filePath: string) {
  const dir = path.dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function readAnnotations(filePath: string): any[] {
  if (!existsSync(filePath)) return []
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

// ─── GET /:bookId → All annotations for a book ──────────────────
annotationsRouter.get('/:bookId', (c) => {
  const filePath = getAnnotationsPath(c.req.param('bookId'))
  if (!filePath) return c.json({ error: 'invalid bookId' }, 400)

  const annotations = readAnnotations(filePath)
  return c.json({ annotations })
})

// ─── GET /:bookId/confusion → Confusion markers only ────────────
annotationsRouter.get('/:bookId/confusion', (c) => {
  const filePath = getAnnotationsPath(c.req.param('bookId'))
  if (!filePath) return c.json({ error: 'invalid bookId' }, 400)

  const all = readAnnotations(filePath)
  const confusion = all.filter((a: any) => a.type === 'confusion')
  return c.json({ annotations: confusion })
})

// ─── POST /:bookId → Create or sync annotations ─────────────────
annotationsRouter.post('/:bookId', async (c) => {
  const filePath = getAnnotationsPath(c.req.param('bookId'))
  if (!filePath) return c.json({ error: 'invalid bookId' }, 400)

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
    ensureDir(filePath)
    // Merge strategy: incoming annotations replace by ID, new ones are added
    const existing = readAnnotations(filePath)
    const existingMap = new Map(existing.map((a: any) => [a.id, a]))

    for (const ann of body.annotations) {
      if (ann.id) {
        existingMap.set(ann.id, ann)
      }
    }

    const merged = Array.from(existingMap.values())
    writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8')

    return c.json({ synced: body.annotations.length, total: merged.length })
  } catch (e) {
    console.error('[annotations] sync failed:', (e as Error).message)
    return c.json({ error: 'failed to sync annotations' }, 500)
  }
})

// ─── DELETE /:bookId/:annotationId → Remove one annotation ──────
annotationsRouter.delete('/:bookId/:annotationId', (c) => {
  const filePath = getAnnotationsPath(c.req.param('bookId'))
  if (!filePath) return c.json({ error: 'invalid bookId' }, 400)

  const annotationId = c.req.param('annotationId')
  if (!annotationId) return c.json({ error: 'missing annotationId' }, 400)

  try {
    const existing = readAnnotations(filePath)
    const filtered = existing.filter((a: any) => a.id !== annotationId)

    if (filtered.length === existing.length) {
      return c.json({ error: 'not found' }, 404)
    }

    ensureDir(filePath)
    writeFileSync(filePath, JSON.stringify(filtered, null, 2) + '\n', 'utf-8')

    return c.json({ removed: 1 })
  } catch (e) {
    console.error('[annotations] delete failed:', (e as Error).message)
    return c.json({ error: 'failed to delete annotation' }, 500)
  }
})
