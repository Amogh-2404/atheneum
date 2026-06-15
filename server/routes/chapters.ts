import { Hono } from 'hono'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import { scheduleCommit, withFileLock } from '../git.js'
import { sanitizeId, safePath } from '../utils.js'
import { validateChapterGraceful } from '../validator.js'
import { assertNoNewErrors, atomicWriteJSON } from '../lib/write-gate.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONTENT_DIR = path.join(__dirname, '..', '..', 'content')

// Mounted at /api/books/:bookId/chapters
export const chaptersRouter = new Hono()

// ─── Helper: resolve + validate chapter path ────────────────────
function getChapterPath(c: any): string | null {
  const bookId = sanitizeId(c.req.param('bookId'))
  const chapterId = sanitizeId(c.req.param('chapterId'))
  if (!bookId || !chapterId) return null
  return safePath(CONTENT_DIR, bookId, 'chapters', `${chapterId}.json`)
}

// ─── GET /:chapterId → Full chapter with blocks ──────────────────
chaptersRouter.get('/:chapterId', (c) => {
  const chapterPath = getChapterPath(c)
  if (!chapterPath) return c.json({ error: 'invalid bookId or chapterId' }, 400)
  if (!existsSync(chapterPath)) return c.json({ error: 'not found' }, 404)

  try {
    const chapter = JSON.parse(readFileSync(chapterPath, 'utf-8'))
    validateChapterGraceful(chapter)
    return c.json(chapter)
  } catch {
    return c.json({ error: 'failed to read chapter' }, 500)
  }
})

// ─── POST /:chapterId/approve → Publish draft blocks ─────────────
chaptersRouter.post('/:chapterId/approve', async (c) => {
  const chapterPath = getChapterPath(c)
  if (!chapterPath) return c.json({ error: 'invalid bookId or chapterId' }, 400)
  if (!existsSync(chapterPath)) return c.json({ error: 'not found' }, 404)

  let body: { blockIds?: string[] }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400)
  }

  if (!Array.isArray(body.blockIds) || body.blockIds.length === 0) {
    return c.json({ error: 'blockIds must be a non-empty array' }, 400)
  }

  return withFileLock(chapterPath, async () => {
    try {
      // `current` is the pristine on-disk chapter (baseline for the gate).
      const current = JSON.parse(readFileSync(chapterPath, 'utf-8'))
      if (!Array.isArray(current.blocks)) {
        return c.json({ error: 'chapter has no blocks array' }, 500)
      }

      // Build `next` by flipping the targeted blocks to published.
      const targetIds = new Set(body.blockIds)
      let approved = 0
      const next = {
        ...current,
        blocks: current.blocks.map((block: any) => {
          if (targetIds.has(block.id)) {
            approved++
            // Provenance: a human reviewed this AI draft and kept it.
            return {
              ...block,
              status: 'published',
              metadata: { ...block.metadata, origin: 'human-approved' },
            }
          }
          return block
        }),
      }

      // Same validated choke point as the MCP path: refuse if this HTTP write
      // would introduce any strict-schema error the chapter didn't already have,
      // and persist atomically (temp + rename) so a crash can't leave a torn file.
      assertNoNewErrors(current, next, chapterPath)
      atomicWriteJSON(chapterPath, next)

      const bookId = sanitizeId(c.req.param('bookId'))
      const chapterId = sanitizeId(c.req.param('chapterId'))
      scheduleCommit(CONTENT_DIR, chapterPath, `Approve ${approved} blocks in ${bookId}/${chapterId}`)

      return c.json({ approved, total: body.blockIds.length })
    } catch (e) {
      console.error(`[chapters] approve failed:`, (e as Error).message)
      return c.json({ error: 'failed to approve blocks' }, 500)
    }
  })
})

// ─── POST /:chapterId/dismiss → Remove draft blocks ──────────────
chaptersRouter.post('/:chapterId/dismiss', async (c) => {
  const chapterPath = getChapterPath(c)
  if (!chapterPath) return c.json({ error: 'invalid bookId or chapterId' }, 400)
  if (!existsSync(chapterPath)) return c.json({ error: 'not found' }, 404)

  let body: { blockIds?: string[] }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400)
  }

  if (!Array.isArray(body.blockIds) || body.blockIds.length === 0) {
    return c.json({ error: 'blockIds must be a non-empty array' }, 400)
  }

  return withFileLock(chapterPath, async () => {
    try {
      const current = JSON.parse(readFileSync(chapterPath, 'utf-8'))
      if (!Array.isArray(current.blocks)) {
        return c.json({ error: 'chapter has no blocks array' }, 500)
      }

      const targetIds = new Set(body.blockIds)
      const before = current.blocks.length
      const nextBlocks = current.blocks.filter((block: any) => !targetIds.has(block.id))
      const removed = before - nextBlocks.length

      const next: any = { ...current, blocks: nextBlocks }
      if ('blockCount' in current) {
        next.blockCount = nextBlocks.length
      }

      // Validated, atomic write — the dismiss route rewrites the blocks array, so
      // it was the largest server-side validation hole; it now goes through the
      // same gate as the MCP author. (Removing blocks can only shrink the error
      // set, so this never spuriously rejects, but it stays on the one path.)
      assertNoNewErrors(current, next, chapterPath)
      atomicWriteJSON(chapterPath, next)

      const bookId = sanitizeId(c.req.param('bookId'))
      const chapterId = sanitizeId(c.req.param('chapterId'))
      scheduleCommit(CONTENT_DIR, chapterPath, `Dismiss ${removed} blocks from ${bookId}/${chapterId}`)

      return c.json({ removed, total: body.blockIds.length })
    } catch (e) {
      console.error(`[chapters] dismiss failed:`, (e as Error).message)
      return c.json({ error: 'failed to dismiss blocks' }, 500)
    }
  })
})

// ─── POST /:chapterId/blocks/:blockId/diagram → Save diagram edits ──
chaptersRouter.post('/:chapterId/blocks/:blockId/diagram', async (c) => {
  const bookId = sanitizeId(c.req.param('bookId'))
  const chapterId = sanitizeId(c.req.param('chapterId'))
  const blockId = c.req.param('blockId')

  console.log(`[diagram] Received save request: book=${bookId} chapter=${chapterId} block=${blockId}`)

  if (!bookId || !chapterId || !blockId) {
    console.log(`[diagram] Invalid params: bookId=${bookId} chapterId=${chapterId} blockId=${blockId}`)
    return c.json({ error: 'invalid bookId, chapterId, or blockId' }, 400)
  }

  const chapterPath = safePath(CONTENT_DIR, bookId, 'chapters', `${chapterId}.json`)
  if (!chapterPath || !existsSync(chapterPath)) {
    console.log(`[diagram] Chapter not found at: ${chapterPath}`)
    return c.json({ error: 'chapter not found' }, 404)
  }

  let body: { elements?: unknown[]; appState?: Record<string, unknown>; files?: Record<string, unknown> }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400)
  }

  if (!body.elements) {
    return c.json({ error: 'elements required' }, 400)
  }

  const cleanAppState: Record<string, unknown> = {}
  if (body.appState?.viewBackgroundColor) cleanAppState.viewBackgroundColor = body.appState.viewBackgroundColor
  if (body.appState?.theme) cleanAppState.theme = body.appState.theme

  return withFileLock(chapterPath, async () => {
    try {
      const current = JSON.parse(readFileSync(chapterPath, 'utf-8'))
      if (!Array.isArray(current.blocks)) {
        return c.json({ error: 'chapter has no blocks array' }, 500)
      }

      const block = current.blocks.find((b: any) => b.id === blockId)
      if (!block) return c.json({ error: 'block not found' }, 404)
      if (block.type !== 'diagram') return c.json({ error: 'block is not a diagram' }, 400)

      const diagramData = { type: 'excalidraw', version: 2, source: 'atheneum', elements: body.elements, appState: cleanAppState, files: body.files || {} }

      if (block.diagramFile) {
        // Excalidraw sidecar file — not a chapter, so no ChapterSchema gate, but
        // still write it atomically (temp + rename) to avoid torn diagram files.
        const diagramPath = safePath(CONTENT_DIR, bookId, 'diagrams', block.diagramFile)
        if (!diagramPath) return c.json({ error: 'invalid diagram file path' }, 400)
        const diagramDir = path.dirname(diagramPath)
        if (!existsSync(diagramDir)) mkdirSync(diagramDir, { recursive: true })
        atomicWriteJSON(diagramPath, diagramData)
        scheduleCommit(CONTENT_DIR, diagramPath, `Update diagram ${block.diagramFile} in ${bookId}`)
      } else {
        // Inline-data path mutates the CHAPTER (the endpoint shoves client-supplied
        // elements into block.inlineData), so it must pass the chapter gate before
        // hitting disk — same validated, atomic choke point as every other writer.
        const next = {
          ...current,
          blocks: current.blocks.map((b: any) =>
            b.id === blockId ? { ...b, inlineData: diagramData } : b,
          ),
        }
        assertNoNewErrors(current, next, chapterPath)
        atomicWriteJSON(chapterPath, next)
        scheduleCommit(CONTENT_DIR, chapterPath, `Update diagram in ${bookId}/${chapterId}`)
      }

      console.log(`[diagram] Saved successfully: ${bookId}/${chapterId}/${blockId}`)
      return c.json({ ok: true })
    } catch (e) {
      console.error(`[diagram] save failed:`, (e as Error).message)
      return c.json({ error: 'failed to save diagram' }, 500)
    }
  })
})
