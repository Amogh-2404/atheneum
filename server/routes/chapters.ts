import { Hono } from 'hono'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { scheduleCommit } from '../git.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONTENT_DIR = path.join(__dirname, '..', '..', 'content')

// Mounted at /api/books/:bookId/chapters
// The bookId param is set by the parent route in index.ts
export const chaptersRouter = new Hono()

// ─── GET /:chapterId → Full chapter with blocks ──────────────────
chaptersRouter.get('/:chapterId', (c) => {
  const bookId = c.req.param('bookId')
  const chapterId = c.req.param('chapterId')

  if (!bookId || !chapterId) {
    return c.json({ error: 'missing bookId or chapterId' }, 400)
  }

  const chapterPath = path.join(CONTENT_DIR, bookId, 'chapters', `${chapterId}.json`)

  if (!existsSync(chapterPath)) {
    return c.json({ error: 'not found' }, 404)
  }

  try {
    const chapter = JSON.parse(readFileSync(chapterPath, 'utf-8'))
    return c.json(chapter)
  } catch {
    return c.json({ error: 'failed to read chapter' }, 500)
  }
})

// ─── POST /:chapterId/approve → Publish draft blocks ─────────────
chaptersRouter.post('/:chapterId/approve', async (c) => {
  const bookId = c.req.param('bookId')
  const chapterId = c.req.param('chapterId')

  if (!bookId || !chapterId) {
    return c.json({ error: 'missing bookId or chapterId' }, 400)
  }

  const chapterPath = path.join(CONTENT_DIR, bookId, 'chapters', `${chapterId}.json`)

  if (!existsSync(chapterPath)) {
    return c.json({ error: 'not found' }, 404)
  }

  let body: { blockIds?: string[] }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400)
  }

  if (!Array.isArray(body.blockIds) || body.blockIds.length === 0) {
    return c.json({ error: 'blockIds must be a non-empty array' }, 400)
  }

  try {
    const chapter = JSON.parse(readFileSync(chapterPath, 'utf-8'))

    if (!Array.isArray(chapter.blocks)) {
      return c.json({ error: 'chapter has no blocks array' }, 500)
    }

    const targetIds = new Set(body.blockIds)
    let approved = 0

    for (const block of chapter.blocks) {
      if (targetIds.has(block.id)) {
        block.status = 'published'
        approved++
      }
    }

    writeFileSync(chapterPath, JSON.stringify(chapter, null, 2) + '\n', 'utf-8')
    scheduleCommit(CONTENT_DIR, chapterPath, `Approve ${approved} blocks in ${bookId}/${chapterId}`)

    return c.json({ approved, total: body.blockIds.length })
  } catch (e) {
    console.error(`[chapters] approve failed:`, (e as Error).message)
    return c.json({ error: 'failed to approve blocks' }, 500)
  }
})

// ─── POST /:chapterId/dismiss → Remove draft blocks ──────────────
chaptersRouter.post('/:chapterId/dismiss', async (c) => {
  const bookId = c.req.param('bookId')
  const chapterId = c.req.param('chapterId')

  if (!bookId || !chapterId) {
    return c.json({ error: 'missing bookId or chapterId' }, 400)
  }

  const chapterPath = path.join(CONTENT_DIR, bookId, 'chapters', `${chapterId}.json`)

  if (!existsSync(chapterPath)) {
    return c.json({ error: 'not found' }, 404)
  }

  let body: { blockIds?: string[] }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400)
  }

  if (!Array.isArray(body.blockIds) || body.blockIds.length === 0) {
    return c.json({ error: 'blockIds must be a non-empty array' }, 400)
  }

  try {
    const chapter = JSON.parse(readFileSync(chapterPath, 'utf-8'))

    if (!Array.isArray(chapter.blocks)) {
      return c.json({ error: 'chapter has no blocks array' }, 500)
    }

    const targetIds = new Set(body.blockIds)
    const before = chapter.blocks.length
    chapter.blocks = chapter.blocks.filter((block: any) => !targetIds.has(block.id))
    const removed = before - chapter.blocks.length

    // Update blockCount if present
    if ('blockCount' in chapter) {
      chapter.blockCount = chapter.blocks.length
    }

    writeFileSync(chapterPath, JSON.stringify(chapter, null, 2) + '\n', 'utf-8')
    scheduleCommit(CONTENT_DIR, chapterPath, `Dismiss ${removed} blocks from ${bookId}/${chapterId}`)

    return c.json({ removed, total: body.blockIds.length })
  } catch (e) {
    console.error(`[chapters] dismiss failed:`, (e as Error).message)
    return c.json({ error: 'failed to dismiss blocks' }, 500)
  }
})
