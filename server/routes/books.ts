import { Hono } from 'hono'
import { readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { sanitizeId, safePath } from '../utils.js'
import { validateBook, validateOutline } from '../validator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONTENT_DIR = path.join(__dirname, '..', '..', 'content')

export const booksRouter = new Hono()

// ─── GET / → List all books ───────────────────────────────────────
booksRouter.get('/', (c) => {
  // Strategy 1: Try reading _index.json
  const indexPath = path.join(CONTENT_DIR, '_index.json')
  if (existsSync(indexPath)) {
    try {
      const data = JSON.parse(readFileSync(indexPath, 'utf-8'))
      return c.json(data)
    } catch {
      // Fall through to directory scan
    }
  }

  // Strategy 2: Scan content/ for subdirectories with book.json
  if (!existsSync(CONTENT_DIR)) {
    return c.json({ books: [] })
  }

  const entries = readdirSync(CONTENT_DIR, { withFileTypes: true })
  const books = []

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue

    const bookJsonPath = path.join(CONTENT_DIR, entry.name, 'book.json')
    if (existsSync(bookJsonPath)) {
      try {
        const book = JSON.parse(readFileSync(bookJsonPath, 'utf-8'))
        // Return summary (without full chapter data)
        books.push({
          id: book.id ?? entry.name,
          title: book.title ?? entry.name,
          subtitle: book.subtitle,
          description: book.description ?? '',
          coverColor: book.coverColor ?? '#333',
          coverIcon: book.coverIcon,
          tags: book.tags ?? [],
          chapterCount: book.chapterCount ?? countChapters(entry.name),
          createdAt: book.createdAt ?? '',
          updatedAt: book.updatedAt ?? '',
        })
      } catch {
        // Skip malformed book.json
      }
    }
  }

  return c.json({ books })
})

// ─── GET /:bookId → Single book with chapter list ─────────────────
booksRouter.get('/:bookId', (c) => {
  const rawId = c.req.param('bookId')
  const bookId = sanitizeId(rawId)
  if (!bookId) return c.json({ error: 'invalid bookId' }, 400)
  const bookDir = safePath(CONTENT_DIR, bookId)
  if (!bookDir) return c.json({ error: 'invalid path' }, 400)
  const bookJsonPath = path.join(bookDir, 'book.json')

  if (!existsSync(bookJsonPath)) {
    return c.json({ error: 'not found' }, 404)
  }

  try {
    const book = JSON.parse(readFileSync(bookJsonPath, 'utf-8'))
    validateBook(book) // advisory — logs warnings if malformed

    // Build chapter summaries from chapter files
    const chaptersDir = path.join(bookDir, 'chapters')
    const chapters = listChapterSummaries(chaptersDir)

    return c.json({
      id: book.id ?? bookId,
      title: book.title ?? bookId,
      subtitle: book.subtitle,
      description: book.description ?? '',
      coverColor: book.coverColor ?? '#333',
      coverIcon: book.coverIcon,
      tags: book.tags ?? [],
      chapterCount: chapters.length,
      createdAt: book.createdAt ?? '',
      updatedAt: book.updatedAt ?? '',
      chapters,
    })
  } catch {
    return c.json({ error: 'failed to read book' }, 500)
  }
})

// ─── GET /:bookId/outline → Book outline ──────────────────────────
booksRouter.get('/:bookId/outline', (c) => {
  const rawId = c.req.param('bookId')
  const bookId = sanitizeId(rawId)
  if (!bookId) return c.json({ error: 'invalid bookId' }, 400)
  const outlinePath = safePath(CONTENT_DIR, bookId, 'outline.json')
  if (!outlinePath) return c.json({ error: 'invalid path' }, 400)

  if (!existsSync(outlinePath)) {
    return c.json({ error: 'not found' }, 404)
  }

  try {
    const outline = JSON.parse(readFileSync(outlinePath, 'utf-8'))
    validateOutline(outline) // advisory
    return c.json(outline)
  } catch {
    return c.json({ error: 'failed to read outline' }, 500)
  }
})

// ─── DELETE /:bookId → Permanently delete a book ─────────────────
booksRouter.delete('/:bookId', async (c) => {
  const rawId = c.req.param('bookId')
  const bookId = sanitizeId(rawId)
  if (!bookId) return c.json({ error: 'invalid bookId' }, 400)
  const bookDir = safePath(CONTENT_DIR, bookId)
  if (!bookDir) return c.json({ error: 'invalid path' }, 400)
  if (!existsSync(bookDir)) return c.json({ error: 'not found' }, 404)

  try {
    rmSync(bookDir, { recursive: true, force: true })

    // Update _index.json
    const indexPath = path.join(CONTENT_DIR, '_index.json')
    if (existsSync(indexPath)) {
      const data = JSON.parse(readFileSync(indexPath, 'utf-8'))
      data.books = (data.books ?? []).filter((b: any) => b.id !== bookId)
      writeFileSync(indexPath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    }

    return c.json({ deleted: true, bookId })
  } catch (e) {
    console.error(`[books] delete failed:`, (e as Error).message)
    return c.json({ error: 'failed to delete book' }, 500)
  }
})

// ─── POST /:bookId/archive → Soft-delete ─────────────────────────
booksRouter.post('/:bookId/archive', async (c) => {
  const rawId = c.req.param('bookId')
  const bookId = sanitizeId(rawId)
  if (!bookId) return c.json({ error: 'invalid bookId' }, 400)
  const bookPath = safePath(CONTENT_DIR, bookId, 'book.json')
  if (!bookPath || !existsSync(bookPath)) return c.json({ error: 'not found' }, 404)

  try {
    const book = JSON.parse(readFileSync(bookPath, 'utf-8'))
    book.status = 'archived'
    book.archivedAt = new Date().toISOString()
    writeFileSync(bookPath, JSON.stringify(book, null, 2) + '\n', 'utf-8')

    // Update _index.json
    const indexPath = path.join(CONTENT_DIR, '_index.json')
    if (existsSync(indexPath)) {
      const data = JSON.parse(readFileSync(indexPath, 'utf-8'))
      for (const b of (data.books ?? [])) {
        if (b.id === bookId) { b.archived = true; b.archivedAt = book.archivedAt }
      }
      writeFileSync(indexPath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    }

    return c.json({ archived: true, bookId })
  } catch (e) {
    console.error(`[books] archive failed:`, (e as Error).message)
    return c.json({ error: 'failed to archive book' }, 500)
  }
})

// ─── POST /:bookId/unarchive → Restore ───────────────────────────
booksRouter.post('/:bookId/unarchive', async (c) => {
  const rawId = c.req.param('bookId')
  const bookId = sanitizeId(rawId)
  if (!bookId) return c.json({ error: 'invalid bookId' }, 400)
  const bookPath = safePath(CONTENT_DIR, bookId, 'book.json')
  if (!bookPath || !existsSync(bookPath)) return c.json({ error: 'not found' }, 404)

  try {
    const book = JSON.parse(readFileSync(bookPath, 'utf-8'))
    delete book.archived
    delete book.archivedAt
    book.status = 'draft'
    writeFileSync(bookPath, JSON.stringify(book, null, 2) + '\n', 'utf-8')

    const indexPath = path.join(CONTENT_DIR, '_index.json')
    if (existsSync(indexPath)) {
      const data = JSON.parse(readFileSync(indexPath, 'utf-8'))
      for (const b of (data.books ?? [])) {
        if (b.id === bookId) { delete b.archived; delete b.archivedAt }
      }
      writeFileSync(indexPath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
    }

    return c.json({ unarchived: true, bookId })
  } catch (e) {
    console.error(`[books] unarchive failed:`, (e as Error).message)
    return c.json({ error: 'failed to unarchive book' }, 500)
  }
})

// ─── Helpers ──────────────────────────────────────────────────────

function countChapters(bookId: string): number {
  const chaptersDir = path.join(CONTENT_DIR, bookId, 'chapters')
  if (!existsSync(chaptersDir)) return 0
  return readdirSync(chaptersDir).filter((f) => f.endsWith('.json')).length
}

function listChapterSummaries(chaptersDir: string) {
  if (!existsSync(chaptersDir)) return []

  const files = readdirSync(chaptersDir)
    .filter((f) => f.endsWith('.json'))
    .sort()

  const summaries = []

  for (const file of files) {
    try {
      const chapter = JSON.parse(readFileSync(path.join(chaptersDir, file), 'utf-8'))
      summaries.push({
        id: chapter.id ?? file.replace('.json', ''),
        number: chapter.number ?? summaries.length + 1,
        title: chapter.title ?? file.replace('.json', ''),
        subtitle: chapter.subtitle,
        estimatedReadMinutes: chapter.estimatedReadMinutes ?? 0,
        blockCount: Array.isArray(chapter.blocks) ? chapter.blocks.length : 0,
      })
    } catch {
      // Skip malformed chapter files
    }
  }

  return summaries
}
