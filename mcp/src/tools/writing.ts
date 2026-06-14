import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import path from 'path'
import { existsSync, readdirSync, mkdirSync } from 'fs'
import { sanitizeId, safePath } from '../../../server/utils.js'
import { validatedWrite } from '../../../server/lib/write-gate.js'
import { safeReadJSON, safeWriteJSON, safeDeleteFile } from '../lib/file-ops.js'
import { generateBlockId, ensureBlockIds, calcReadTime } from '../lib/block-utils.js'

export function registerWritingTools(server: McpServer, contentDir: string) {

  // ─── write_chapter ───────────────────────────────────────────────
  server.tool(
    'write_chapter',
    'Write or replace an entire chapter. Validates against Atheneum schema. Use for initial creation or full rewrites.',
    {
      bookId: z.string().describe('Book slug'),
      chapterId: z.string().describe('Chapter file slug (e.g., "02-market-making")'),
      chapter: z.object({
        title: z.string(),
        subtitle: z.string().optional(),
        number: z.number().optional(),
        estimatedReadMinutes: z.number().optional(),
        blocks: z.array(z.any()).describe('Array of block objects (heading, text, callout, code, etc.)'),
      }).describe('Chapter data. Blocks should follow the Atheneum block schema.'),
    },
    async ({ bookId, chapterId, chapter }) => {
      try {
        const cleanBook = sanitizeId(bookId)
        const cleanChapter = sanitizeId(chapterId)
        if (!cleanBook || !cleanChapter) return { content: [{ type: 'text' as const, text: `write_chapter failed: invalid IDs` }], isError: true }

        const chapterPath = safePath(contentDir, cleanBook, 'chapters', `${cleanChapter}.json`)
        if (!chapterPath) return { content: [{ type: 'text' as const, text: `write_chapter failed: path traversal detected` }], isError: true }

        // Ensure book directory exists
        const bookDir = safePath(contentDir, cleanBook)
        if (!bookDir || !existsSync(bookDir)) {
          return { content: [{ type: 'text' as const, text: `write_chapter failed: book "${bookId}" does not exist. Use create_book first.` }], isError: true }
        }

        // Ensure block IDs and uniqueness
        const { blocks, warnings } = ensureBlockIds(chapter.blocks)

        // Set metadata.updatedAt on all blocks
        const now = new Date().toISOString()
        for (const block of blocks) {
          if (!block.metadata) block.metadata = {}
          block.metadata.updatedAt = now
        }

        const chapterData = {
          _schema: 1,
          id: cleanChapter,
          number: chapter.number,
          title: chapter.title,
          subtitle: chapter.subtitle,
          estimatedReadMinutes: chapter.estimatedReadMinutes ?? calcReadTime(blocks),
          blockCount: blocks.length,
          blocks,
        }

        // write_chapter is the full create/rewrite path and the most likely tool
        // to introduce a malformed block — it MUST go through the gate. As a
        // brand-new/replacement chapter the baseline is whatever is on disk now,
        // so the no-new-errors gate behaves as a strict gate for a fresh write.
        await validatedWrite(chapterPath, () => chapterData)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              written: true,
              path: `${cleanBook}/chapters/${cleanChapter}.json`,
              blockCount: blocks.length,
              estimatedReadMinutes: chapterData.estimatedReadMinutes,
              validationWarnings: warnings,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `write_chapter failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── insert_blocks ───────────────────────────────────────────────
  server.tool(
    'insert_blocks',
    'Insert blocks at a specific position in a chapter. Use afterBlockId="start" for beginning.',
    {
      bookId: z.string(),
      chapterId: z.string(),
      afterBlockId: z.string().describe('"start" to insert at beginning, or a block ID to insert after'),
      blocks: z.array(z.any()).describe('Block objects to insert'),
      status: z.enum(['draft', 'published']).optional().default('draft').describe('Status for inserted blocks'),
    },
    async ({ bookId, chapterId, afterBlockId, blocks: newBlocks, status }) => {
      try {
        const cleanBook = sanitizeId(bookId)
        const cleanChapter = sanitizeId(chapterId)
        if (!cleanBook || !cleanChapter) return { content: [{ type: 'text' as const, text: `insert_blocks failed: invalid IDs` }], isError: true }

        const chapterPath = safePath(contentDir, cleanBook, 'chapters', `${cleanChapter}.json`)
        if (!chapterPath) return { content: [{ type: 'text' as const, text: `insert_blocks failed: path traversal` }], isError: true }

        const chapter = await safeReadJSON(chapterPath)
        if (!chapter) return { content: [{ type: 'text' as const, text: `insert_blocks failed: chapter not found` }], isError: true }

        // Ensure IDs on new blocks
        const { blocks: prepared, warnings } = ensureBlockIds(newBlocks)

        // Set status and metadata
        const now = new Date().toISOString()
        for (const block of prepared) {
          block.status = status ?? 'draft'
          if (!block.metadata) block.metadata = {}
          block.metadata.insertedAfter = afterBlockId
          block.metadata.createdAt = now
          block.metadata.updatedAt = now
        }

        // Routed through the gate: inserting a malformed block (e.g. a quiz
        // missing correctIndex) is rejected before it ever reaches disk.
        const result = await validatedWrite(chapterPath, (current) => {
          if (!current) throw new Error('chapter not found')
          const blocks = current?.blocks ?? []

          let insertIdx: number
          if (afterBlockId === 'start') {
            insertIdx = 0
          } else {
            const idx = blocks.findIndex((b: any) => b.id === afterBlockId)
            if (idx === -1) {
              throw new Error(`Block "${afterBlockId}" not found in chapter`)
            }
            insertIdx = idx + 1
          }

          blocks.splice(insertIdx, 0, ...prepared)

          return {
            ...current,
            blocks,
            blockCount: blocks.length,
            estimatedReadMinutes: calcReadTime(blocks),
          }
        })

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              inserted: prepared.length,
              blockCount: result.blockCount,
              insertedIds: prepared.map((b: any) => b.id),
              warnings,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `insert_blocks failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── update_blocks ───────────────────────────────────────────────
  server.tool(
    'update_blocks',
    'Update specific blocks by ID. Merges patch onto existing block (preserves id and type). Use for fixing typos, improving content.',
    {
      bookId: z.string(),
      chapterId: z.string(),
      updates: z.array(z.object({
        blockId: z.string().describe('ID of block to update'),
        patch: z.record(z.string(), z.any()).describe('Fields to merge onto the block'),
      })),
    },
    async ({ bookId, chapterId, updates }) => {
      try {
        const cleanBook = sanitizeId(bookId)
        const cleanChapter = sanitizeId(chapterId)
        if (!cleanBook || !cleanChapter) return { content: [{ type: 'text' as const, text: `update_blocks failed: invalid IDs` }], isError: true }

        const chapterPath = safePath(contentDir, cleanBook, 'chapters', `${cleanChapter}.json`)
        if (!chapterPath) return { content: [{ type: 'text' as const, text: `update_blocks failed: path traversal` }], isError: true }

        const notFound: string[] = []
        let updated = 0
        const now = new Date().toISOString()

        // Routed through the strict write-gate: the resulting chapter is
        // validated against the Atheneum schema inside the lock, and persisted
        // ONLY if it passes. A schema failure throws with the exact issue path
        // (e.g. "blocks.7.correctIndex: Required"), which the catch below hands
        // back to the AI author as an isError result — never a malformed write.
        await validatedWrite(chapterPath, (current) => {
          if (!current?.blocks) throw new Error('Chapter has no blocks')

          const blockMap = new Map<string, any>()
          for (const block of current.blocks) {
            blockMap.set(block.id, block)
          }

          for (const { blockId, patch } of updates) {
            const block = blockMap.get(blockId)
            if (!block) {
              notFound.push(blockId)
              continue
            }

            // Shallow merge, preserve id and type
            const preservedId = block.id
            const preservedType = block.type
            Object.assign(block, patch)
            block.id = preservedId
            block.type = preservedType

            if (!block.metadata) block.metadata = {}
            block.metadata.updatedAt = now
            updated++
          }

          return {
            ...current,
            estimatedReadMinutes: calcReadTime(current.blocks),
          }
        })

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ updated, notFound }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `update_blocks failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── remove_blocks ───────────────────────────────────────────────
  server.tool(
    'remove_blocks',
    'Remove specific blocks from a chapter by their IDs',
    {
      bookId: z.string(),
      chapterId: z.string(),
      blockIds: z.array(z.string()).describe('IDs of blocks to remove'),
    },
    async ({ bookId, chapterId, blockIds }) => {
      try {
        const cleanBook = sanitizeId(bookId)
        const cleanChapter = sanitizeId(chapterId)
        if (!cleanBook || !cleanChapter) return { content: [{ type: 'text' as const, text: `remove_blocks failed: invalid IDs` }], isError: true }

        const chapterPath = safePath(contentDir, cleanBook, 'chapters', `${cleanChapter}.json`)
        if (!chapterPath) return { content: [{ type: 'text' as const, text: `remove_blocks failed: path traversal` }], isError: true }

        const idsToRemove = new Set(blockIds)

        // Routed through the gate. Removing blocks can only shrink the error
        // set, so this never trips the no-new-errors check — but it now also
        // writes atomically and stays on the single validated path.
        const result = await validatedWrite(chapterPath, (current) => {
          if (!current?.blocks) throw new Error('Chapter has no blocks')
          const before = current.blocks.length
          current.blocks = current.blocks.filter((b: any) => !idsToRemove.has(b.id))
          current.blockCount = current.blocks.length
          current.estimatedReadMinutes = calcReadTime(current.blocks)
          return current
        })

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              removed: blockIds.length - (result.blocks?.length ?? 0) + (blockIds.length),
              blockCount: result.blockCount,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `remove_blocks failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── move_blocks ─────────────────────────────────────────────────
  server.tool(
    'move_blocks',
    'Reorder blocks within a chapter. Move specified blocks to after a target block.',
    {
      bookId: z.string(),
      chapterId: z.string(),
      blockIds: z.array(z.string()).describe('IDs of blocks to move'),
      afterBlockId: z.string().describe('"start" or a block ID to place after'),
    },
    async ({ bookId, chapterId, blockIds, afterBlockId }) => {
      try {
        const cleanBook = sanitizeId(bookId)
        const cleanChapter = sanitizeId(chapterId)
        if (!cleanBook || !cleanChapter) return { content: [{ type: 'text' as const, text: `move_blocks failed: invalid IDs` }], isError: true }

        const chapterPath = safePath(contentDir, cleanBook, 'chapters', `${cleanChapter}.json`)
        if (!chapterPath) return { content: [{ type: 'text' as const, text: `move_blocks failed: path traversal` }], isError: true }

        const idsToMove = new Set(blockIds)

        // Routed through the gate. Reordering preserves the block set so it
        // cannot introduce new errors — but it stays on the single validated,
        // atomic write path like every other chapter mutation.
        await validatedWrite(chapterPath, (current) => {
          if (!current?.blocks) throw new Error('Chapter has no blocks')

          // Extract blocks to move
          const moving = current.blocks.filter((b: any) => idsToMove.has(b.id))
          const remaining = current.blocks.filter((b: any) => !idsToMove.has(b.id))

          if (moving.length === 0) throw new Error('None of the specified blocks found')

          // Find insertion point
          let insertIdx: number
          if (afterBlockId === 'start') {
            insertIdx = 0
          } else {
            const idx = remaining.findIndex((b: any) => b.id === afterBlockId)
            if (idx === -1) throw new Error(`Target block "${afterBlockId}" not found`)
            insertIdx = idx + 1
          }

          remaining.splice(insertIdx, 0, ...moving)
          current.blocks = remaining
          return current
        })

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ moved: blockIds.length }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `move_blocks failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── delete_chapter (with cascade) ────────────────────────────────
  server.tool(
    'delete_chapter',
    'Delete a chapter with full cascade: removes annotations, clears reading position, updates outline. Recoverable via git revert.',
    {
      bookId: z.string(),
      chapterId: z.string(),
    },
    async ({ bookId, chapterId }) => {
      try {
        const cleanBook = sanitizeId(bookId)
        const cleanChapter = sanitizeId(chapterId)
        if (!cleanBook || !cleanChapter) return { content: [{ type: 'text' as const, text: `delete_chapter failed: invalid IDs` }], isError: true }

        const chapterPath = safePath(contentDir, cleanBook, 'chapters', `${cleanChapter}.json`)
        if (!chapterPath) return { content: [{ type: 'text' as const, text: `delete_chapter failed: path traversal` }], isError: true }

        const deleted = safeDeleteFile(chapterPath)
        if (!deleted) return { content: [{ type: 'text' as const, text: `delete_chapter failed: file not found` }], isError: true }

        let annotationsRemoved = 0
        let readingPositionCleared = false
        let outlineUpdated = false

        // Cascade 1: Remove annotations for this chapter
        const annoPath = safePath(contentDir, cleanBook, '.annotations', 'annotations.json')
        if (annoPath) {
          const annoData = await safeReadJSON(annoPath)
          if (annoData?.annotations) {
            const before = annoData.annotations.length
            annoData.annotations = annoData.annotations.filter((a: any) => a.chapterId !== cleanChapter)
            annotationsRemoved = before - annoData.annotations.length
            if (annotationsRemoved > 0) {
              await safeWriteJSON(annoPath, () => annoData)
            }
          }
        }

        // Cascade 2: Clear reading position if it points to this chapter
        const posPath = safePath(contentDir, cleanBook, '.state', 'reading-position.json')
        if (posPath) {
          const posData = await safeReadJSON(posPath)
          if (posData?.chapterId === cleanChapter) {
            await safeWriteJSON(posPath, () => ({ bookId: cleanBook, chapterId: null, scrollPercent: 0 }))
            readingPositionCleared = true
          }
        }

        // Cascade 3: Remove from outline
        const outlinePath = safePath(contentDir, cleanBook, 'outline.json')
        if (outlinePath) {
          const outline = await safeReadJSON(outlinePath)
          if (outline?.chapters) {
            const before = outline.chapters.length
            outline.chapters = outline.chapters.filter((ch: any) => ch.id !== cleanChapter)
            if (outline.chapters.length < before) {
              await safeWriteJSON(outlinePath, () => outline)
              outlineUpdated = true
            }
          }
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              deleted: true,
              path: `${cleanBook}/chapters/${cleanChapter}.json`,
              annotationsRemoved,
              readingPositionCleared,
              outlineUpdated,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `delete_chapter failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── duplicate_chapter ───────────────────────────────────────────
  server.tool(
    'duplicate_chapter',
    'Copy a chapter with fresh block IDs. All blocks set to draft. Annotations are NOT copied.',
    {
      bookId: z.string(),
      chapterId: z.string(),
      newChapterId: z.string().optional().describe('New chapter ID. Auto-generated if omitted.'),
    },
    async ({ bookId, chapterId, newChapterId }) => {
      try {
        const cleanBook = sanitizeId(bookId)
        const cleanChapter = sanitizeId(chapterId)
        if (!cleanBook || !cleanChapter) return { content: [{ type: 'text' as const, text: `duplicate_chapter failed: invalid IDs` }], isError: true }

        const srcPath = safePath(contentDir, cleanBook, 'chapters', `${cleanChapter}.json`)
        if (!srcPath) return { content: [{ type: 'text' as const, text: `duplicate_chapter failed: path traversal` }], isError: true }

        const chapter = await safeReadJSON(srcPath)
        if (!chapter) return { content: [{ type: 'text' as const, text: `duplicate_chapter failed: source not found` }], isError: true }

        // Determine new chapter ID
        const chaptersDir = safePath(contentDir, cleanBook, 'chapters')
        if (!chaptersDir) return { content: [{ type: 'text' as const, text: `duplicate_chapter failed: path traversal` }], isError: true }

        let targetId: string
        if (newChapterId) {
          const clean = sanitizeId(newChapterId)
          if (!clean) return { content: [{ type: 'text' as const, text: `duplicate_chapter failed: invalid newChapterId` }], isError: true }
          targetId = clean
        } else {
          // Auto: find highest number, add 1
          const files = existsSync(chaptersDir) ? readdirSync(chaptersDir).filter(f => f.endsWith('.json')).sort() : []
          const maxNum = files.reduce((max, f) => {
            const m = f.match(/^(\d+)-/)
            return m ? Math.max(max, parseInt(m[1])) : max
          }, 0)
          const slug = cleanChapter.replace(/^\d+-/, '')
          targetId = `${String(maxNum + 1).padStart(2, '0')}-${slug}-copy`
        }

        const targetPath = safePath(contentDir, cleanBook, 'chapters', `${targetId}.json`)
        if (!targetPath) return { content: [{ type: 'text' as const, text: `duplicate_chapter failed: path traversal` }], isError: true }

        // Regenerate all block IDs
        const now = new Date().toISOString()
        const newBlocks = chapter.blocks.map((block: any) => ({
          ...block,
          id: generateBlockId(),
          status: 'draft',
          metadata: { ...block.metadata, createdAt: now, updatedAt: now },
        }))

        const newChapter = {
          ...chapter,
          id: targetId,
          number: (chapter.number ?? 0) + 100, // Append to end
          blocks: newBlocks,
          blockCount: newBlocks.length,
        }

        // Duplication is a full-replacement write of a brand-new chapter file.
        // Route it through the gate so a copy can never persist a chapter the
        // strict schema would reject (the target is new, so baseline is empty).
        await validatedWrite(targetPath, () => newChapter)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              duplicated: true,
              sourceChapterId: cleanChapter,
              newChapterId: targetId,
              blockCount: newBlocks.length,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `duplicate_chapter failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── move_chapter ────────────────────────────────────────────────
  server.tool(
    'move_chapter',
    'Move a chapter from one book to another. Migrates annotations, clears reading position, updates outlines.',
    {
      fromBookId: z.string(),
      chapterId: z.string(),
      toBookId: z.string(),
    },
    async ({ fromBookId, chapterId, toBookId }) => {
      try {
        const cleanFrom = sanitizeId(fromBookId)
        const cleanChapter = sanitizeId(chapterId)
        const cleanTo = sanitizeId(toBookId)
        if (!cleanFrom || !cleanChapter || !cleanTo) return { content: [{ type: 'text' as const, text: `move_chapter failed: invalid IDs` }], isError: true }
        if (cleanFrom === cleanTo) return { content: [{ type: 'text' as const, text: `move_chapter failed: source and target are the same book` }], isError: true }

        const srcPath = safePath(contentDir, cleanFrom, 'chapters', `${cleanChapter}.json`)
        const dstDir = safePath(contentDir, cleanTo, 'chapters')
        if (!srcPath || !dstDir) return { content: [{ type: 'text' as const, text: `move_chapter failed: path traversal` }], isError: true }

        if (!existsSync(srcPath)) return { content: [{ type: 'text' as const, text: `move_chapter failed: chapter not found in source` }], isError: true }

        const dstBookDir = safePath(contentDir, cleanTo)
        if (!dstBookDir || !existsSync(dstBookDir)) return { content: [{ type: 'text' as const, text: `move_chapter failed: target book does not exist` }], isError: true }

        // Read chapter
        const chapter = await safeReadJSON(srcPath)
        if (!chapter) return { content: [{ type: 'text' as const, text: `move_chapter failed: could not read chapter` }], isError: true }

        // Write to target through the gate — moving a chapter between books is
        // still a chapter write and must not be able to land a malformed file
        // at the destination.
        const dstPath = path.join(dstDir, `${cleanChapter}.json`)
        if (!existsSync(dstDir)) mkdirSync(dstDir, { recursive: true })
        await validatedWrite(dstPath, () => chapter)

        // Migrate annotations
        let annotationsMigrated = 0
        const srcAnnoPath = safePath(contentDir, cleanFrom, '.annotations', 'annotations.json')
        const dstAnnoPath = safePath(contentDir, cleanTo, '.annotations', 'annotations.json')
        if (srcAnnoPath && dstAnnoPath) {
          const srcAnno = await safeReadJSON(srcAnnoPath)
          if (srcAnno?.annotations) {
            const toMove = srcAnno.annotations.filter((a: any) => a.chapterId === cleanChapter)
            const toKeep = srcAnno.annotations.filter((a: any) => a.chapterId !== cleanChapter)
            annotationsMigrated = toMove.length

            if (toMove.length > 0) {
              // Update bookId on migrated annotations
              toMove.forEach((a: any) => { a.bookId = cleanTo })
              await safeWriteJSON(srcAnnoPath, () => ({ annotations: toKeep }))

              // Merge into target
              await safeWriteJSON(dstAnnoPath, (current) => {
                const existing = current?.annotations ?? []
                return { annotations: [...existing, ...toMove] }
              })
            }
          }
        }

        // Clear reading position if it points to moved chapter
        const posPath = safePath(contentDir, cleanFrom, '.state', 'reading-position.json')
        if (posPath) {
          const pos = await safeReadJSON(posPath)
          if (pos?.chapterId === cleanChapter) {
            await safeWriteJSON(posPath, () => ({ bookId: cleanFrom, chapterId: null, scrollPercent: 0 }))
          }
        }

        // Update source outline
        const srcOutline = safePath(contentDir, cleanFrom, 'outline.json')
        if (srcOutline) {
          const outline = await safeReadJSON(srcOutline)
          if (outline?.chapters) {
            outline.chapters = outline.chapters.filter((ch: any) => ch.id !== cleanChapter)
            await safeWriteJSON(srcOutline, () => outline)
          }
        }

        // Delete from source
        safeDeleteFile(srcPath)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              moved: true,
              fromBook: cleanFrom,
              toBook: cleanTo,
              chapterId: cleanChapter,
              annotationsMigrated,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `move_chapter failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── import_markdown ─────────────────────────────────────────────
  server.tool(
    'import_markdown',
    'Import a markdown string as a chapter. Parses headings, paragraphs, code blocks, lists, math, tables, and dividers into Atheneum blocks.',
    {
      bookId: z.string(),
      chapterId: z.string(),
      markdown: z.string().describe('Raw markdown content'),
      title: z.string().optional().describe('Chapter title. Extracted from first # heading if omitted.'),
    },
    async ({ bookId, chapterId, markdown, title }) => {
      try {
        const cleanBook = sanitizeId(bookId)
        const cleanChapter = sanitizeId(chapterId)
        if (!cleanBook || !cleanChapter) return { content: [{ type: 'text' as const, text: `import_markdown failed: invalid IDs` }], isError: true }

        const bookDir = safePath(contentDir, cleanBook)
        if (!bookDir || !existsSync(bookDir)) return { content: [{ type: 'text' as const, text: `import_markdown failed: book not found` }], isError: true }

        const chapterPath = safePath(contentDir, cleanBook, 'chapters', `${cleanChapter}.json`)
        if (!chapterPath) return { content: [{ type: 'text' as const, text: `import_markdown failed: path traversal` }], isError: true }

        const blocks: any[] = []
        const typeCounts: Record<string, number> = {}
        let extractedTitle = title

        const lines = markdown.split('\n')
        let i = 0

        while (i < lines.length) {
          const line = lines[i]

          // Empty line — skip
          if (line.trim() === '') { i++; continue }

          // Heading
          const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
          if (headingMatch) {
            const level = headingMatch[1].length as 1 | 2 | 3
            const text = headingMatch[2].trim()
            if (!extractedTitle && level === 1) extractedTitle = text
            blocks.push({ id: generateBlockId(), type: 'heading', status: 'draft', level, text })
            typeCounts.heading = (typeCounts.heading ?? 0) + 1
            i++; continue
          }

          // Fenced code block
          const codeMatch = line.match(/^```(\w*)/)
          if (codeMatch) {
            const language = codeMatch[1] || 'text'
            const codeLines: string[] = []
            i++
            while (i < lines.length && !lines[i].startsWith('```')) {
              codeLines.push(lines[i])
              i++
            }
            i++ // skip closing ```
            blocks.push({ id: generateBlockId(), type: 'code', status: 'draft', language, code: codeLines.join('\n') })
            typeCounts.code = (typeCounts.code ?? 0) + 1
            continue
          }

          // Math block ($$)
          if (line.trim() === '$$') {
            const mathLines: string[] = []
            i++
            while (i < lines.length && lines[i].trim() !== '$$') {
              mathLines.push(lines[i])
              i++
            }
            i++ // skip closing $$
            blocks.push({ id: generateBlockId(), type: 'math', status: 'draft', expression: mathLines.join('\n') })
            typeCounts.math = (typeCounts.math ?? 0) + 1
            continue
          }

          // Horizontal rule
          if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
            blocks.push({ id: generateBlockId(), type: 'divider', status: 'draft', style: 'line' })
            typeCounts.divider = (typeCounts.divider ?? 0) + 1
            i++; continue
          }

          // Blockquote
          if (line.startsWith('>')) {
            const quoteLines: string[] = []
            while (i < lines.length && lines[i].startsWith('>')) {
              quoteLines.push(lines[i].replace(/^>\s?/, ''))
              i++
            }
            const text = quoteLines.join('\n').trim()
            blocks.push({ id: generateBlockId(), type: 'callout', status: 'draft', variant: 'note', text })
            typeCounts.callout = (typeCounts.callout ?? 0) + 1
            continue
          }

          // Table
          if (line.includes('|') && line.trim().startsWith('|')) {
            const tableLines: string[] = []
            while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
              tableLines.push(lines[i])
              i++
            }
            if (tableLines.length >= 2) {
              const parseRow = (row: string) => row.split('|').filter(c => c.trim()).map(c => c.trim())
              const headers = parseRow(tableLines[0])
              // Skip separator row (|---|---|)
              const dataRows = tableLines.slice(2).map(parseRow)
              blocks.push({ id: generateBlockId(), type: 'table', status: 'draft', headers, rows: dataRows })
              typeCounts.table = (typeCounts.table ?? 0) + 1
            }
            continue
          }

          // List (unordered or ordered)
          if (/^(\s*[-*]|\s*\d+\.)\s/.test(line)) {
            const isOrdered = /^\s*\d+\./.test(line)
            const items: any[] = []
            while (i < lines.length && /^(\s*[-*]|\s*\d+\.)\s/.test(lines[i])) {
              const text = lines[i].replace(/^\s*[-*]\s|^\s*\d+\.\s/, '').trim()
              items.push({ text })
              i++
            }
            blocks.push({ id: generateBlockId(), type: 'list', status: 'draft', style: isOrdered ? 'ordered' : 'unordered', items })
            typeCounts.list = (typeCounts.list ?? 0) + 1
            continue
          }

          // Image
          const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
          if (imgMatch) {
            blocks.push({ id: generateBlockId(), type: 'figure', status: 'draft', alt: imgMatch[1], src: imgMatch[2], layout: 'center' })
            typeCounts.figure = (typeCounts.figure ?? 0) + 1
            i++; continue
          }

          // Default: text paragraph (collect consecutive non-empty lines)
          const paraLines: string[] = []
          while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('```') && !lines[i].startsWith('>') && !lines[i].startsWith('|') && !/^---+$/.test(lines[i].trim()) && !/^(\s*[-*]|\s*\d+\.)\s/.test(lines[i])) {
            paraLines.push(lines[i])
            i++
          }
          if (paraLines.length > 0) {
            blocks.push({ id: generateBlockId(), type: 'text', status: 'draft', text: paraLines.join('\n') })
            typeCounts.text = (typeCounts.text ?? 0) + 1
          }
        }

        const chapterData = {
          _schema: 1,
          id: cleanChapter,
          title: extractedTitle ?? 'Imported Chapter',
          estimatedReadMinutes: calcReadTime(blocks),
          blockCount: blocks.length,
          blocks,
        }

        // import_markdown is a full-creation path — route it through the gate
        // so a malformed parse result can never be persisted.
        await validatedWrite(chapterPath, () => chapterData)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              imported: true,
              chapterId: cleanChapter,
              title: chapterData.title,
              blockCount: blocks.length,
              blockTypes: typeCounts,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `import_markdown failed: ${err.message}` }], isError: true }
      }
    }
  )
}
