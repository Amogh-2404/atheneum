import { Hono } from 'hono'
import { readFileSync, readdirSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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
  const { bookId } = c.req.param()
  const bookDir = path.join(CONTENT_DIR, bookId)
  const bookJsonPath = path.join(bookDir, 'book.json')

  if (!existsSync(bookJsonPath)) {
    return c.json({ error: 'not found' }, 404)
  }

  try {
    const book = JSON.parse(readFileSync(bookJsonPath, 'utf-8'))

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
  const { bookId } = c.req.param()
  const outlinePath = path.join(CONTENT_DIR, bookId, 'outline.json')

  if (!existsSync(outlinePath)) {
    return c.json({ error: 'not found' }, 404)
  }

  try {
    const outline = JSON.parse(readFileSync(outlinePath, 'utf-8'))
    return c.json(outline)
  } catch {
    return c.json({ error: 'failed to read outline' }, 500)
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
