import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import path from 'path'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { sanitizeId, safePath } from '../../../server/utils.js'
import { safeReadJSON } from '../lib/file-ops.js'
import { extractBlockText, extractText } from '../lib/block-utils.js'

export function registerReadingTools(server: McpServer, contentDir: string) {

  // ─── list_books ──────────────────────────────────────────────────
  server.tool(
    'list_books',
    'List all books in the library with metadata summaries. Archived books are excluded by default.',
    {
      includeArchived: z.boolean().optional().default(false).describe('Include archived books in results'),
    },
    async ({ includeArchived }) => {
      try {
        // Try _index.json first
        const indexPath = path.join(contentDir, '_index.json')
        const indexData = await safeReadJSON(indexPath)
        if (indexData?.books) {
          const filtered = includeArchived ? indexData.books : indexData.books.filter((b: any) => !b.archived)
          return { content: [{ type: 'text' as const, text: JSON.stringify({ books: filtered }, null, 2) }] }
        }

        // Fallback: scan directories
        if (!existsSync(contentDir)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ books: [] }) }] }
        }

        const entries = readdirSync(contentDir, { withFileTypes: true })
        const books: any[] = []

        for (const entry of entries) {
          if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue
          const bookJsonPath = path.join(contentDir, entry.name, 'book.json')
          const book = await safeReadJSON(bookJsonPath)
          if (book) {
            const chaptersDir = path.join(contentDir, entry.name, 'chapters')
            const chapterCount = existsSync(chaptersDir)
              ? readdirSync(chaptersDir).filter(f => f.endsWith('.json')).length
              : 0
            books.push({
              id: book.id ?? entry.name,
              title: book.title ?? entry.name,
              subtitle: book.subtitle,
              description: book.description ?? '',
              coverColor: book.coverColor ?? '#333',
              coverIcon: book.coverIcon,
              tags: book.tags ?? [],
              chapterCount: book.chapterCount ?? chapterCount,
              createdAt: book.createdAt ?? '',
              updatedAt: book.updatedAt ?? '',
            })
          }
        }

        return { content: [{ type: 'text' as const, text: JSON.stringify({ books }, null, 2) }] }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `list_books failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── get_book ────────────────────────────────────────────────────
  server.tool(
    'get_book',
    'Get a book\'s full metadata and chapter listing',
    { bookId: z.string().describe('Book slug (e.g., "imc-prosperity-4")') },
    async ({ bookId }) => {
      try {
        const cleanId = sanitizeId(bookId)
        if (!cleanId) return { content: [{ type: 'text' as const, text: `get_book failed: invalid bookId "${bookId}"` }], isError: true }

        const bookDir = safePath(contentDir, cleanId)
        if (!bookDir) return { content: [{ type: 'text' as const, text: `get_book failed: path traversal detected` }], isError: true }

        const bookPath = path.join(bookDir, 'book.json')
        const book = await safeReadJSON(bookPath)
        if (!book) return { content: [{ type: 'text' as const, text: `get_book failed: book "${bookId}" not found` }], isError: true }

        // Get chapter summaries
        const chaptersDir = path.join(bookDir, 'chapters')
        const chapters: any[] = []
        if (existsSync(chaptersDir)) {
          const files = readdirSync(chaptersDir).filter(f => f.endsWith('.json')).sort()
          for (const file of files) {
            const chapter = await safeReadJSON(path.join(chaptersDir, file))
            if (chapter) {
              chapters.push({
                id: chapter.id ?? file.replace('.json', ''),
                number: chapter.number,
                title: chapter.title,
                subtitle: chapter.subtitle,
                estimatedReadMinutes: chapter.estimatedReadMinutes,
                blockCount: chapter.blockCount ?? chapter.blocks?.length,
              })
            }
          }
        }

        return { content: [{ type: 'text' as const, text: JSON.stringify({ ...book, chapters }, null, 2) }] }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `get_book failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── get_chapter ─────────────────────────────────────────────────
  server.tool(
    'get_chapter',
    'Get a chapter\'s full content including all blocks. Read this before editing.',
    {
      bookId: z.string().describe('Book slug'),
      chapterId: z.string().describe('Chapter slug (e.g., "01-order-books")'),
    },
    async ({ bookId, chapterId }) => {
      try {
        const cleanBook = sanitizeId(bookId)
        const cleanChapter = sanitizeId(chapterId)
        if (!cleanBook || !cleanChapter) return { content: [{ type: 'text' as const, text: `get_chapter failed: invalid IDs` }], isError: true }

        const chapterPath = safePath(contentDir, cleanBook, 'chapters', `${cleanChapter}.json`)
        if (!chapterPath) return { content: [{ type: 'text' as const, text: `get_chapter failed: path traversal detected` }], isError: true }

        const chapter = await safeReadJSON(chapterPath)
        if (!chapter) return { content: [{ type: 'text' as const, text: `get_chapter failed: chapter "${chapterId}" not found in book "${bookId}"` }], isError: true }

        return { content: [{ type: 'text' as const, text: JSON.stringify(chapter, null, 2) }] }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `get_chapter failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── get_outline ─────────────────────────────────────────────────
  server.tool(
    'get_outline',
    'Get a book\'s outline — planned chapters, concept index, prerequisites',
    { bookId: z.string().describe('Book slug') },
    async ({ bookId }) => {
      try {
        const cleanId = sanitizeId(bookId)
        if (!cleanId) return { content: [{ type: 'text' as const, text: `get_outline failed: invalid bookId` }], isError: true }

        const outlinePath = safePath(contentDir, cleanId, 'outline.json')
        if (!outlinePath) return { content: [{ type: 'text' as const, text: `get_outline failed: path traversal` }], isError: true }

        const outline = await safeReadJSON(outlinePath)
        if (!outline) return { content: [{ type: 'text' as const, text: `get_outline failed: no outline found for "${bookId}"` }], isError: true }

        return { content: [{ type: 'text' as const, text: JSON.stringify(outline, null, 2) }] }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `get_outline failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── search_content ──────────────────────────────────────────────
  server.tool(
    'search_content',
    'Full-text search across all books and chapters. Returns matching blocks with context.',
    {
      query: z.string().describe('Search query'),
      bookId: z.string().optional().describe('Limit search to a specific book'),
      limit: z.number().optional().default(20).describe('Maximum results to return'),
    },
    async ({ query, bookId, limit }) => {
      try {
        if (!query.trim()) return { content: [{ type: 'text' as const, text: JSON.stringify({ results: [] }) }] }

        const queryLower = query.toLowerCase()
        const results: any[] = []

        // Determine which books to search
        const bookDirs: { id: string; dir: string }[] = []
        if (bookId) {
          const cleanId = sanitizeId(bookId)
          if (cleanId) {
            const dir = safePath(contentDir, cleanId)
            if (dir && existsSync(dir)) bookDirs.push({ id: cleanId, dir })
          }
        } else {
          if (existsSync(contentDir)) {
            for (const entry of readdirSync(contentDir, { withFileTypes: true })) {
              if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) {
                bookDirs.push({ id: entry.name, dir: path.join(contentDir, entry.name) })
              }
            }
          }
        }

        for (const { id: bId, dir: bookDir } of bookDirs) {
          if (results.length >= (limit ?? 20)) break

          const bookJson = await safeReadJSON(path.join(bookDir, 'book.json'))
          const bookTitle = bookJson?.title ?? bId

          const chaptersDir = path.join(bookDir, 'chapters')
          if (!existsSync(chaptersDir)) continue

          for (const file of readdirSync(chaptersDir).filter(f => f.endsWith('.json')).sort()) {
            if (results.length >= (limit ?? 20)) break

            const chapter = await safeReadJSON(path.join(chaptersDir, file))
            if (!chapter?.blocks) continue

            for (const block of chapter.blocks) {
              if (results.length >= (limit ?? 20)) break

              const text = extractBlockText(block)
              const textLower = text.toLowerCase()
              const matchIdx = textLower.indexOf(queryLower)

              if (matchIdx !== -1) {
                const start = Math.max(0, matchIdx - 50)
                const end = Math.min(text.length, matchIdx + query.length + 50)
                const snippet = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '')

                results.push({
                  bookId: bId,
                  bookTitle,
                  chapterId: chapter.id ?? file.replace('.json', ''),
                  chapterTitle: chapter.title,
                  blockId: block.id,
                  blockType: block.type,
                  snippet: snippet.trim(),
                })
              }
            }
          }
        }

        return { content: [{ type: 'text' as const, text: JSON.stringify({ results, total: results.length }, null, 2) }] }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `search_content failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── get_stats ───────────────────────────────────────────────────
  server.tool(
    'get_stats',
    'Platform health at a glance: total books, chapters, blocks, drafts, annotations, confusion markers, word count.',
    {
      bookId: z.string().optional().describe('Scope to a single book. Omit for global stats.'),
    },
    async ({ bookId }) => {
      try {
        const stats = {
          totalBooks: 0, archivedBooks: 0, totalChapters: 0, totalBlocks: 0,
          draftBlocks: 0, publishedBlocks: 0, totalAnnotations: 0,
          confusionMarkers: 0, totalWords: 0, estimatedReadHours: 0,
        }

        const bookDirs: { id: string; dir: string }[] = []
        if (bookId) {
          const cleanId = sanitizeId(bookId)
          if (cleanId) {
            const dir = safePath(contentDir, cleanId)
            if (dir && existsSync(dir)) bookDirs.push({ id: cleanId, dir })
          }
        } else {
          if (existsSync(contentDir)) {
            for (const entry of readdirSync(contentDir, { withFileTypes: true })) {
              if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) {
                bookDirs.push({ id: entry.name, dir: path.join(contentDir, entry.name) })
              }
            }
          }
        }

        stats.totalBooks = bookDirs.length

        for (const { dir: bookDir } of bookDirs) {
          const bookJson = await safeReadJSON(path.join(bookDir, 'book.json'))
          if (bookJson?.status === 'archived' || bookJson?.archived) stats.archivedBooks++

          const chaptersDir = path.join(bookDir, 'chapters')
          if (existsSync(chaptersDir)) {
            for (const file of readdirSync(chaptersDir).filter(f => f.endsWith('.json'))) {
              stats.totalChapters++
              const chapter = await safeReadJSON(path.join(chaptersDir, file))
              if (chapter?.blocks) {
                for (const block of chapter.blocks) {
                  stats.totalBlocks++
                  if (block.status === 'draft') stats.draftBlocks++
                  else stats.publishedBlocks++
                  const text = extractBlockText(block)
                  stats.totalWords += text.trim().split(/\s+/).filter(Boolean).length
                }
              }
            }
          }

          const annoPath = path.join(bookDir, '.annotations', 'annotations.json')
          const annoData = await safeReadJSON(annoPath)
          if (annoData?.annotations) {
            stats.totalAnnotations += annoData.annotations.length
            stats.confusionMarkers += annoData.annotations.filter((a: any) => a.type === 'confusion').length
          }
        }

        stats.estimatedReadHours = Math.round(stats.totalWords / 200 / 60 * 10) / 10

        return { content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }] }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `get_stats failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── validate_content ────────────────────────────────────────────
  server.tool(
    'validate_content',
    'Dry-run validation: checks blocks against schema, verifies IDs are unique, confirms blockCount matches, validates outline references.',
    {
      bookId: z.string(),
      chapterId: z.string().optional().describe('Validate one chapter. Omit to validate entire book.'),
    },
    async ({ bookId, chapterId }) => {
      try {
        const cleanBook = sanitizeId(bookId)
        if (!cleanBook) return { content: [{ type: 'text' as const, text: `validate_content failed: invalid bookId` }], isError: true }

        const issues: { file: string; message: string; severity: 'error' | 'warning' | 'info' }[] = []

        const chaptersDir = safePath(contentDir, cleanBook, 'chapters')
        if (!chaptersDir || !existsSync(chaptersDir)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ valid: true, issues: [], message: 'No chapters to validate.' }, null, 2) }] }
        }

        const files = chapterId
          ? [`${sanitizeId(chapterId)}.json`]
          : readdirSync(chaptersDir).filter(f => f.endsWith('.json')).sort()

        for (const file of files) {
          const filePath = path.join(chaptersDir, file)
          if (!existsSync(filePath)) {
            issues.push({ file, message: 'File not found', severity: 'error' })
            continue
          }

          const chapter = await safeReadJSON(filePath)
          if (!chapter) {
            issues.push({ file, message: 'Invalid JSON', severity: 'error' })
            continue
          }

          // Check required fields
          if (!chapter.title) issues.push({ file, message: 'Missing title', severity: 'error' })
          if (!chapter.id) issues.push({ file, message: 'Missing id', severity: 'error' })

          // Check blockCount
          if (chapter.blocks) {
            if (chapter.blockCount !== undefined && chapter.blockCount !== chapter.blocks.length) {
              issues.push({ file, message: `blockCount (${chapter.blockCount}) doesn't match blocks.length (${chapter.blocks.length})`, severity: 'warning' })
            }

            // Check block ID uniqueness
            const ids = new Set<string>()
            for (const block of chapter.blocks) {
              if (!block.id) {
                issues.push({ file, message: `Block missing id (type: ${block.type})`, severity: 'error' })
              } else if (ids.has(block.id)) {
                issues.push({ file, message: `Duplicate block ID: ${block.id}`, severity: 'error' })
              } else {
                ids.add(block.id)
              }

              if (!block.type) {
                issues.push({ file, message: `Block ${block.id} missing type`, severity: 'error' })
              }
            }

            // Check estimatedReadMinutes
            if (chapter.estimatedReadMinutes !== undefined) {
              if (chapter.estimatedReadMinutes === 0) {
                issues.push({ file, message: 'estimatedReadMinutes is 0', severity: 'warning' })
              } else if (chapter.estimatedReadMinutes > 120) {
                issues.push({ file, message: `estimatedReadMinutes is ${chapter.estimatedReadMinutes} (>2 hours, suspiciously high)`, severity: 'info' })
              }
            }
          } else {
            issues.push({ file, message: 'No blocks array', severity: 'error' })
          }
        }

        // Validate outline references
        if (!chapterId) {
          const outlinePath = safePath(contentDir, cleanBook, 'outline.json')
          if (outlinePath && existsSync(outlinePath)) {
            const outline = await safeReadJSON(outlinePath)
            if (outline?.chapters) {
              const existingFiles = new Set(readdirSync(chaptersDir).map(f => f.replace('.json', '')))
              for (const ch of outline.chapters) {
                if (!existingFiles.has(ch.id)) {
                  issues.push({ file: 'outline.json', message: `References non-existent chapter: ${ch.id}`, severity: 'warning' })
                }
              }
            }
          }
        }

        const errors = issues.filter(i => i.severity === 'error').length
        const warnings = issues.filter(i => i.severity === 'warning').length

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              valid: errors === 0,
              errors,
              warnings,
              issues,
              summary: errors === 0 && warnings === 0
                ? 'Content is valid. No issues found.'
                : `${errors} error${errors !== 1 ? 's' : ''}, ${warnings} warning${warnings !== 1 ? 's' : ''}.`,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `validate_content failed: ${err.message}` }], isError: true }
      }
    }
  )
}
