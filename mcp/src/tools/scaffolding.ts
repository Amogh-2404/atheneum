import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import path from 'path'
import { existsSync, mkdirSync, readdirSync, rmSync, renameSync, readFileSync, writeFileSync } from 'fs'
import { sanitizeId, safePath } from '../../../server/utils.js'
import { safeReadJSON, safeWriteJSON, safeWriteJSONDirect } from '../lib/file-ops.js'

export function registerScaffoldingTools(server: McpServer, contentDir: string) {

  // ─── create_book ─────────────────────────────────────────────────
  server.tool(
    'create_book',
    'Create a new book with directory structure, book.json, and initial outline. Updates _index.json.',
    {
      id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).describe('Book slug (lowercase, hyphens, e.g., "machine-learning")'),
      title: z.string(),
      subtitle: z.string().optional(),
      description: z.string().optional(),
      coverColor: z.string().optional().default('#333'),
      coverIcon: z.string().optional(),
      tags: z.array(z.string()).optional(),
      outlineChapters: z.array(z.object({
        id: z.string(),
        title: z.string(),
        concepts: z.array(z.string()).optional(),
        prereqs: z.array(z.string()).optional(),
        estimatedBlocks: z.number().optional(),
      })).optional().describe('Planned chapters for the outline'),
    },
    async ({ id, title, subtitle, description, coverColor, coverIcon, tags, outlineChapters }) => {
      try {
        const cleanId = sanitizeId(id)
        if (!cleanId) return { content: [{ type: 'text' as const, text: `create_book failed: invalid id "${id}"` }], isError: true }

        const bookDir = safePath(contentDir, cleanId)
        if (!bookDir) return { content: [{ type: 'text' as const, text: `create_book failed: path traversal` }], isError: true }

        if (existsSync(bookDir)) {
          return { content: [{ type: 'text' as const, text: `create_book failed: book "${id}" already exists` }], isError: true }
        }

        // Create directories
        const dirs = ['chapters', 'images', 'diagrams']
        for (const dir of dirs) {
          mkdirSync(path.join(bookDir, dir), { recursive: true })
        }

        const now = new Date().toISOString()

        // Write book.json
        const bookData = {
          _schema: 1,
          id: cleanId,
          title,
          subtitle: subtitle ?? '',
          description: description ?? '',
          author: 'Amogh',
          createdAt: now,
          updatedAt: now,
          coverColor: coverColor ?? '#333',
          coverIcon: coverIcon,
          status: 'draft',
          tags: tags ?? [],
        }
        await safeWriteJSONDirect(path.join(bookDir, 'book.json'), bookData)

        // Write outline.json
        const outlineData = {
          _schema: 1,
          bookId: cleanId,
          chapters: (outlineChapters ?? []).map(ch => ({
            ...ch,
            status: 'planned' as const,
          })),
          conceptIndex: {},
        }
        await safeWriteJSONDirect(path.join(bookDir, 'outline.json'), outlineData)

        // Update _index.json
        const indexPath = path.join(contentDir, '_index.json')
        await safeWriteJSON(indexPath, (current) => {
          const books = current?.books ?? []
          books.push({
            id: cleanId,
            title,
            subtitle: subtitle ?? '',
            description: description ?? '',
            coverColor: coverColor ?? '#333',
            coverIcon: coverIcon,
            tags: tags ?? [],
            chapterCount: 0,
            createdAt: now,
            updatedAt: now,
          })
          return { books }
        })

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              created: true,
              bookId: cleanId,
              directories: dirs.map(d => `${cleanId}/${d}`),
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `create_book failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── update_book_metadata ────────────────────────────────────────
  server.tool(
    'update_book_metadata',
    'Update a book\'s metadata (title, description, cover, tags). Does not touch chapters.',
    {
      bookId: z.string(),
      patch: z.object({
        title: z.string().optional(),
        subtitle: z.string().optional(),
        description: z.string().optional(),
        coverColor: z.string().optional(),
        coverIcon: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
    },
    async ({ bookId, patch }) => {
      try {
        const cleanId = sanitizeId(bookId)
        if (!cleanId) return { content: [{ type: 'text' as const, text: `update_book_metadata failed: invalid bookId` }], isError: true }

        const bookPath = safePath(contentDir, cleanId, 'book.json')
        if (!bookPath) return { content: [{ type: 'text' as const, text: `update_book_metadata failed: path traversal` }], isError: true }

        if (!existsSync(bookPath)) {
          return { content: [{ type: 'text' as const, text: `update_book_metadata failed: book not found` }], isError: true }
        }

        await safeWriteJSON(bookPath, (current) => {
          const updated = { ...current, ...patch, updatedAt: new Date().toISOString() }
          return updated
        })

        return { content: [{ type: 'text' as const, text: JSON.stringify({ updated: true }, null, 2) }] }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `update_book_metadata failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── update_outline ──────────────────────────────────────��───────
  server.tool(
    'update_outline',
    'Update a book\'s outline — chapters, concept index, prerequisites',
    {
      bookId: z.string(),
      outline: z.object({
        chapters: z.array(z.object({
          id: z.string(),
          title: z.string(),
          concepts: z.array(z.string()).optional(),
          prereqs: z.array(z.string()).optional(),
          estimatedBlocks: z.number().optional(),
          status: z.enum(['planned', 'writing', 'complete']).optional(),
        })).optional(),
        conceptIndex: z.record(z.string(), z.any()).optional(),
      }),
    },
    async ({ bookId, outline }) => {
      try {
        const cleanId = sanitizeId(bookId)
        if (!cleanId) return { content: [{ type: 'text' as const, text: `update_outline failed: invalid bookId` }], isError: true }

        const outlinePath = safePath(contentDir, cleanId, 'outline.json')
        if (!outlinePath) return { content: [{ type: 'text' as const, text: `update_outline failed: path traversal` }], isError: true }

        await safeWriteJSON(outlinePath, (current) => {
          return {
            ...(current ?? {}),
            _schema: 1,
            bookId: cleanId,
            ...outline,
          }
        })

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              updated: true,
              chapterCount: outline.chapters?.length ?? 0,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `update_outline failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── set_chapter_status ──────────────────────────────────────────
  server.tool(
    'set_chapter_status',
    'Set blocks to published or draft status. Used for the approve/dismiss workflow.',
    {
      bookId: z.string(),
      chapterId: z.string(),
      blockIds: z.array(z.string()).describe('IDs of blocks to update'),
      status: z.enum(['draft', 'published']),
    },
    async ({ bookId, chapterId, blockIds, status }) => {
      try {
        const cleanBook = sanitizeId(bookId)
        const cleanChapter = sanitizeId(chapterId)
        if (!cleanBook || !cleanChapter) return { content: [{ type: 'text' as const, text: `set_chapter_status failed: invalid IDs` }], isError: true }

        const chapterPath = safePath(contentDir, cleanBook, 'chapters', `${cleanChapter}.json`)
        if (!chapterPath) return { content: [{ type: 'text' as const, text: `set_chapter_status failed: path traversal` }], isError: true }

        const targetIds = new Set(blockIds)
        let updated = 0

        await safeWriteJSON(chapterPath, (current) => {
          if (!current?.blocks) throw new Error('Chapter has no blocks')
          for (const block of current.blocks) {
            if (targetIds.has(block.id)) {
              block.status = status
              updated++
            }
          }
          return current
        })

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ updated }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `set_chapter_status failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── delete_book ─────────────────────────────────────────────────
  server.tool(
    'delete_book',
    'Permanently delete a book and ALL its contents (chapters, annotations, reading positions, images, diagrams). Removes from _index.json. Recoverable via git.',
    {
      bookId: z.string(),
      confirm: z.boolean().describe('Must be true to proceed — safety gate'),
    },
    async ({ bookId, confirm }) => {
      try {
        if (!confirm) return { content: [{ type: 'text' as const, text: `delete_book aborted: confirm must be true` }], isError: true }

        const cleanId = sanitizeId(bookId)
        if (!cleanId) return { content: [{ type: 'text' as const, text: `delete_book failed: invalid bookId` }], isError: true }

        const bookDir = safePath(contentDir, cleanId)
        if (!bookDir) return { content: [{ type: 'text' as const, text: `delete_book failed: path traversal` }], isError: true }
        if (!existsSync(bookDir)) return { content: [{ type: 'text' as const, text: `delete_book failed: book not found` }], isError: true }

        // Count what we're deleting
        const chaptersDir = path.join(bookDir, 'chapters')
        const chapterCount = existsSync(chaptersDir) ? readdirSync(chaptersDir).filter(f => f.endsWith('.json')).length : 0

        // Delete entire book directory (recursive)
        rmSync(bookDir, { recursive: true, force: true })

        // Update _index.json
        const indexPath = path.join(contentDir, '_index.json')
        await safeWriteJSON(indexPath, (current) => {
          const books = (current?.books ?? []).filter((b: any) => b.id !== cleanId)
          return { books }
        })

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              deleted: true,
              bookId: cleanId,
              chaptersRemoved: chapterCount,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `delete_book failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── archive_book ────────────────────────────────────────────────
  server.tool(
    'archive_book',
    'Soft-delete: hide a book from listings without destroying data. Use unarchive_book to restore.',
    { bookId: z.string() },
    async ({ bookId }) => {
      try {
        const cleanId = sanitizeId(bookId)
        if (!cleanId) return { content: [{ type: 'text' as const, text: `archive_book failed: invalid bookId` }], isError: true }

        const bookPath = safePath(contentDir, cleanId, 'book.json')
        if (!bookPath || !existsSync(bookPath)) return { content: [{ type: 'text' as const, text: `archive_book failed: book not found` }], isError: true }

        const now = new Date().toISOString()

        await safeWriteJSON(bookPath, (current) => ({
          ...current,
          status: 'archived',
          archivedAt: now,
        }))

        // Update _index.json
        const indexPath = path.join(contentDir, '_index.json')
        await safeWriteJSON(indexPath, (current) => {
          const books = current?.books ?? []
          for (const b of books) {
            if (b.id === cleanId) {
              b.archived = true
              b.archivedAt = now
            }
          }
          return { books }
        })

        return { content: [{ type: 'text' as const, text: JSON.stringify({ archived: true, bookId: cleanId }, null, 2) }] }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `archive_book failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── unarchive_book ──────────────────────────────────────────────
  server.tool(
    'unarchive_book',
    'Restore an archived book to active listings.',
    { bookId: z.string() },
    async ({ bookId }) => {
      try {
        const cleanId = sanitizeId(bookId)
        if (!cleanId) return { content: [{ type: 'text' as const, text: `unarchive_book failed: invalid bookId` }], isError: true }

        const bookPath = safePath(contentDir, cleanId, 'book.json')
        if (!bookPath || !existsSync(bookPath)) return { content: [{ type: 'text' as const, text: `unarchive_book failed: book not found` }], isError: true }

        await safeWriteJSON(bookPath, (current) => {
          const { archived, archivedAt, ...rest } = current
          return { ...rest, status: 'draft' }
        })

        const indexPath = path.join(contentDir, '_index.json')
        await safeWriteJSON(indexPath, (current) => {
          const books = current?.books ?? []
          for (const b of books) {
            if (b.id === cleanId) {
              delete b.archived
              delete b.archivedAt
            }
          }
          return { books }
        })

        return { content: [{ type: 'text' as const, text: JSON.stringify({ unarchived: true, bookId: cleanId }, null, 2) }] }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `unarchive_book failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── reorder_chapters ────────────────────────────────────────────
  server.tool(
    'reorder_chapters',
    'Reorder chapters in a book. Provide chapter slugs (without number prefix) in desired order. Files are renamed and numbering updated.',
    {
      bookId: z.string(),
      order: z.array(z.string()).describe('Chapter slugs in desired order (e.g., ["order-books", "market-making"])'),
    },
    async ({ bookId, order }) => {
      try {
        const cleanBook = sanitizeId(bookId)
        if (!cleanBook) return { content: [{ type: 'text' as const, text: `reorder_chapters failed: invalid bookId` }], isError: true }

        const chaptersDir = safePath(contentDir, cleanBook, 'chapters')
        if (!chaptersDir || !existsSync(chaptersDir)) return { content: [{ type: 'text' as const, text: `reorder_chapters failed: chapters dir not found` }], isError: true }

        const files = readdirSync(chaptersDir).filter(f => f.endsWith('.json')).sort()
        const changes: { oldId: string; newId: string }[] = []

        // Build slug → current file mapping
        const slugToFile = new Map<string, string>()
        for (const file of files) {
          const slug = file.replace('.json', '').replace(/^\d+-/, '')
          slugToFile.set(slug, file)
        }

        // Validate all slugs exist
        for (const slug of order) {
          if (!slugToFile.has(slug)) {
            return { content: [{ type: 'text' as const, text: `reorder_chapters failed: slug "${slug}" not found. Available: ${[...slugToFile.keys()].join(', ')}` }], isError: true }
          }
        }

        // Rename to temp files first (avoid collision)
        const tempPrefix = '_reorder_temp_'
        for (const slug of order) {
          const oldFile = slugToFile.get(slug)!
          const tempFile = `${tempPrefix}${slug}.json`
          renameSync(path.join(chaptersDir, oldFile), path.join(chaptersDir, tempFile))
        }

        // Rename from temp to final with new numbering
        for (let i = 0; i < order.length; i++) {
          const slug = order[i]
          const num = String(i + 1).padStart(2, '0')
          const newId = `${num}-${slug}`
          const newFile = `${newId}.json`
          const tempFile = `${tempPrefix}${slug}.json`

          renameSync(path.join(chaptersDir, tempFile), path.join(chaptersDir, newFile))

          // Update chapter JSON
          const chapterPath = path.join(chaptersDir, newFile)
          const chapter = JSON.parse(readFileSync(chapterPath, 'utf-8'))
          const oldId = chapter.id
          chapter.id = newId
          chapter.number = i + 1
          writeFileSync(chapterPath, JSON.stringify(chapter, null, 2) + '\n', 'utf-8')

          if (oldId !== newId) {
            changes.push({ oldId, newId })
          }
        }

        // Update annotations if chapter IDs changed
        if (changes.length > 0) {
          const annoPath = safePath(contentDir, cleanBook, '.annotations', 'annotations.json')
          if (annoPath && existsSync(annoPath)) {
            const idMap = new Map(changes.map(c => [c.oldId, c.newId]))
            await safeWriteJSON(annoPath, (current) => {
              if (!current?.annotations) return current
              for (const anno of current.annotations) {
                if (idMap.has(anno.chapterId)) {
                  anno.chapterId = idMap.get(anno.chapterId)
                }
              }
              return current
            })
          }

          // Update reading position
          const posPath = safePath(contentDir, cleanBook, '.state', 'reading-position.json')
          if (posPath && existsSync(posPath)) {
            const idMap = new Map(changes.map(c => [c.oldId, c.newId]))
            await safeWriteJSON(posPath, (current) => {
              if (current?.chapterId && idMap.has(current.chapterId)) {
                current.chapterId = idMap.get(current.chapterId)
              }
              return current
            })
          }
        }

        // Update outline order
        const outlinePath = safePath(contentDir, cleanBook, 'outline.json')
        if (outlinePath && existsSync(outlinePath)) {
          const idMap = new Map(changes.map(c => [c.oldId, c.newId]))
          await safeWriteJSON(outlinePath, (current) => {
            if (!current?.chapters) return current
            // Update IDs
            for (const ch of current.chapters) {
              if (idMap.has(ch.id)) {
                ch.id = idMap.get(ch.id)
              }
            }
            // Reorder to match
            const orderMap = new Map(order.map((slug, i) => {
              const num = String(i + 1).padStart(2, '0')
              return [`${num}-${slug}`, i]
            }))
            current.chapters.sort((a: any, b: any) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999))
            return current
          })
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ reordered: true, changes, totalChapters: order.length }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `reorder_chapters failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── cleanup_orphans ─────────────────────────────────────────────
  server.tool(
    'cleanup_orphans',
    'Audit and optionally fix orphaned data: annotations referencing deleted blocks/chapters, stale reading positions, ghost outline entries, phantom _index.json entries.',
    {
      bookId: z.string().optional().describe('Scope to a single book. Omit for global audit.'),
      fix: z.boolean().describe('If true, remove orphans. If false, report only.'),
    },
    async ({ bookId, fix }) => {
      try {
        const report = {
          orphanedAnnotations: 0,
          orphanedPositions: 0,
          orphanedOutlineEntries: 0,
          orphanedIndexEntries: 0,
          details: [] as string[],
          fixed: fix,
        }

        // Determine which books to audit
        const bookIds: string[] = []
        if (bookId) {
          const cleanId = sanitizeId(bookId)
          if (cleanId) bookIds.push(cleanId)
        } else {
          if (existsSync(contentDir)) {
            for (const entry of readdirSync(contentDir, { withFileTypes: true })) {
              if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) {
                bookIds.push(entry.name)
              }
            }
          }
        }

        // Audit _index.json
        const indexPath = path.join(contentDir, '_index.json')
        const indexData = await safeReadJSON(indexPath)
        if (indexData?.books) {
          const orphanedBooks = indexData.books.filter((b: any) => {
            const dir = safePath(contentDir, b.id)
            return !dir || !existsSync(dir)
          })
          report.orphanedIndexEntries = orphanedBooks.length
          for (const b of orphanedBooks) {
            report.details.push(`_index.json: book "${b.id}" has no directory`)
          }
          if (fix && orphanedBooks.length > 0) {
            const validBooks = indexData.books.filter((b: any) => {
              const dir = safePath(contentDir, b.id)
              return dir && existsSync(dir)
            })
            await safeWriteJSON(indexPath, () => ({ books: validBooks }))
          }
        }

        // Per-book audit
        for (const bId of bookIds) {
          const bookDir = safePath(contentDir, bId)
          if (!bookDir || !existsSync(bookDir)) continue

          // Get existing chapter IDs
          const chaptersDir = path.join(bookDir, 'chapters')
          const chapterIds = new Set<string>()
          const blockIds = new Map<string, Set<string>>()
          if (existsSync(chaptersDir)) {
            for (const file of readdirSync(chaptersDir).filter(f => f.endsWith('.json'))) {
              const chId = file.replace('.json', '')
              chapterIds.add(chId)
              const chapter = await safeReadJSON(path.join(chaptersDir, file))
              if (chapter?.blocks) {
                blockIds.set(chId, new Set(chapter.blocks.map((b: any) => b.id)))
              }
            }
          }

          // Audit annotations
          const annoPath = safePath(contentDir, bId, '.annotations', 'annotations.json')
          if (annoPath && existsSync(annoPath)) {
            const annoData = await safeReadJSON(annoPath)
            if (annoData?.annotations) {
              const orphaned = annoData.annotations.filter((a: any) => {
                if (!chapterIds.has(a.chapterId)) return true
                const blocks = blockIds.get(a.chapterId)
                if (a.blockId && blocks && !blocks.has(a.blockId)) return true
                return false
              })
              report.orphanedAnnotations += orphaned.length
              for (const a of orphaned.slice(0, 5)) {
                report.details.push(`${bId}: annotation ${a.id} references ${a.chapterId}/${a.blockId} (not found)`)
              }
              if (fix && orphaned.length > 0) {
                const orphanIds = new Set(orphaned.map((a: any) => a.id))
                annoData.annotations = annoData.annotations.filter((a: any) => !orphanIds.has(a.id))
                await safeWriteJSON(annoPath, () => annoData)
              }
            }
          }

          // Audit reading position
          const posPath = safePath(contentDir, bId, '.state', 'reading-position.json')
          if (posPath && existsSync(posPath)) {
            const pos = await safeReadJSON(posPath)
            if (pos?.chapterId && !chapterIds.has(pos.chapterId)) {
              report.orphanedPositions++
              report.details.push(`${bId}: reading position points to deleted chapter "${pos.chapterId}"`)
              if (fix) {
                await safeWriteJSON(posPath, () => ({ bookId: bId, chapterId: null, scrollPercent: 0 }))
              }
            }
          }

          // Audit outline
          const outlinePath = safePath(contentDir, bId, 'outline.json')
          if (outlinePath && existsSync(outlinePath)) {
            const outline = await safeReadJSON(outlinePath)
            if (outline?.chapters) {
              const orphaned = outline.chapters.filter((ch: any) => !chapterIds.has(ch.id))
              report.orphanedOutlineEntries += orphaned.length
              for (const ch of orphaned) {
                report.details.push(`${bId}: outline references missing chapter "${ch.id}"`)
              }
              if (fix && orphaned.length > 0) {
                outline.chapters = outline.chapters.filter((ch: any) => chapterIds.has(ch.id))
                await safeWriteJSON(outlinePath, () => outline)
              }
            }
          }
        }

        const total = report.orphanedAnnotations + report.orphanedPositions + report.orphanedOutlineEntries + report.orphanedIndexEntries
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              ...report,
              total,
              summary: total === 0
                ? 'No orphaned data found — everything is clean.'
                : `Found ${total} orphan${total !== 1 ? 's' : ''}${fix ? ' — all fixed.' : '. Run with fix:true to clean up.'}`,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `cleanup_orphans failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── rename_book ─────────────────────────────────────────────────
  server.tool(
    'rename_book',
    'Change a book\'s slug (directory name). Updates all internal references: book.json, outline, annotations, reading position, _index.json.',
    {
      bookId: z.string().describe('Current book slug'),
      newId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/).describe('New book slug'),
    },
    async ({ bookId, newId }) => {
      try {
        const cleanOld = sanitizeId(bookId)
        const cleanNew = sanitizeId(newId)
        if (!cleanOld || !cleanNew) return { content: [{ type: 'text' as const, text: `rename_book failed: invalid IDs` }], isError: true }
        if (cleanOld === cleanNew) return { content: [{ type: 'text' as const, text: `rename_book failed: old and new IDs are the same` }], isError: true }

        const oldDir = safePath(contentDir, cleanOld)
        const newDir = safePath(contentDir, cleanNew)
        if (!oldDir || !newDir) return { content: [{ type: 'text' as const, text: `rename_book failed: path traversal` }], isError: true }
        if (!existsSync(oldDir)) return { content: [{ type: 'text' as const, text: `rename_book failed: book not found` }], isError: true }
        if (existsSync(newDir)) return { content: [{ type: 'text' as const, text: `rename_book failed: "${newId}" already exists` }], isError: true }

        // Rename directory
        renameSync(oldDir, newDir)

        // Update book.json
        const bookPath = path.join(newDir, 'book.json')
        if (existsSync(bookPath)) {
          await safeWriteJSON(bookPath, (current) => ({ ...current, id: cleanNew }))
        }

        // Update outline.json
        const outlinePath = path.join(newDir, 'outline.json')
        if (existsSync(outlinePath)) {
          await safeWriteJSON(outlinePath, (current) => ({ ...current, bookId: cleanNew }))
        }

        // Update annotations bookId
        const annoPath = path.join(newDir, '.annotations', 'annotations.json')
        if (existsSync(annoPath)) {
          await safeWriteJSON(annoPath, (current) => {
            if (!current?.annotations) return current
            for (const a of current.annotations) {
              if (a.bookId === cleanOld) a.bookId = cleanNew
            }
            return current
          })
        }

        // Update reading position bookId
        const posPath = path.join(newDir, '.state', 'reading-position.json')
        if (existsSync(posPath)) {
          await safeWriteJSON(posPath, (current) => {
            if (current?.bookId === cleanOld) current.bookId = cleanNew
            return current
          })
        }

        // Update _index.json
        const indexPath = path.join(contentDir, '_index.json')
        await safeWriteJSON(indexPath, (current) => {
          const books = current?.books ?? []
          for (const b of books) {
            if (b.id === cleanOld) b.id = cleanNew
          }
          return { books }
        })

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ renamed: true, oldId: cleanOld, newId: cleanNew }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `rename_book failed: ${err.message}` }], isError: true }
      }
    }
  )
}
