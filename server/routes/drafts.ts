import { Hono } from 'hono'
import { existsSync, readFileSync, readdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { sanitizeId, safePath } from '../utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CONTENT_DIR = path.join(__dirname, '..', '..', 'content')

export const draftsRouter = new Hono()

function plain(text: unknown): string {
  if (typeof text === 'string') return text
  if (Array.isArray(text)) return text.map((s: any) => s?.text || '').join('')
  return ''
}

// GET /:bookId → pending ai-improve-loop drafts across the book (Morning Brief).
draftsRouter.get('/:bookId', (c) => {
  const clean = sanitizeId(c.req.param('bookId'))
  if (!clean) return c.json({ error: 'invalid bookId' }, 400)
  const chaptersDir = safePath(CONTENT_DIR, clean, 'chapters')
  if (!chaptersDir || !existsSync(chaptersDir)) return c.json({ drafts: [] })

  const drafts: any[] = []
  for (const file of readdirSync(chaptersDir)) {
    if (!file.endsWith('.json')) continue
    let chapter: any
    try { chapter = JSON.parse(readFileSync(path.join(chaptersDir, file), 'utf-8')) } catch { continue }
    const blocks: any[] = chapter.blocks || []
    const byId = new Map(blocks.map((b) => [b.id, b]))
    for (const b of blocks) {
      if (b.status === 'draft' && b.metadata?.origin === 'ai-improve-loop') {
        const targetId = b.metadata.revisionOf || b.metadata.insertedAfter
        const target = targetId ? byId.get(targetId) : null
        drafts.push({
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          chapterNumber: chapter.number,
          draftId: b.id,
          targetId,
          signal: b.metadata.sourceSignal || '',
          before: plain(target?.text).slice(0, 600),
          after: plain(b.text).slice(0, 600),
        })
      }
    }
  }
  return c.json({ drafts, count: drafts.length })
})
