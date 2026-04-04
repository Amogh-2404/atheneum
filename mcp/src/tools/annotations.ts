import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import path from 'path'
import { sanitizeId, safePath } from '../../../server/utils.js'
import { safeReadJSON } from '../lib/file-ops.js'

export function registerAnnotationTools(server: McpServer, contentDir: string) {

  // ─── get_annotations ─────────────────────────────────────────────
  server.tool(
    'get_annotations',
    'Get user annotations for a book (highlights, bookmarks, margin notes, confusion markers). Optionally filter by type.',
    {
      bookId: z.string(),
      type: z.enum(['highlight', 'bookmark', 'margin-note', 'confusion']).optional().describe('Filter by annotation type'),
    },
    async ({ bookId, type }) => {
      try {
        const cleanId = sanitizeId(bookId)
        if (!cleanId) return { content: [{ type: 'text' as const, text: `get_annotations failed: invalid bookId` }], isError: true }

        const annoPath = safePath(contentDir, cleanId, '.annotations', 'annotations.json')
        if (!annoPath) return { content: [{ type: 'text' as const, text: `get_annotations failed: path traversal` }], isError: true }

        const data = await safeReadJSON(annoPath)
        let annotations = data?.annotations ?? []

        if (type) {
          annotations = annotations.filter((a: any) => a.type === type)
        }

        return { content: [{ type: 'text' as const, text: JSON.stringify({ annotations, count: annotations.length }, null, 2) }] }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `get_annotations failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── get_confusion_markers ───────────────────────────────────────
  server.tool(
    'get_confusion_markers',
    'Get confusion markers for a book — indicates content that needs improvement. Use before running improve_chapter.',
    { bookId: z.string() },
    async ({ bookId }) => {
      try {
        const cleanId = sanitizeId(bookId)
        if (!cleanId) return { content: [{ type: 'text' as const, text: `get_confusion_markers failed: invalid bookId` }], isError: true }

        const annoPath = safePath(contentDir, cleanId, '.annotations', 'annotations.json')
        if (!annoPath) return { content: [{ type: 'text' as const, text: `get_confusion_markers failed: path traversal` }], isError: true }

        const data = await safeReadJSON(annoPath)
        const markers = (data?.annotations ?? []).filter((a: any) => a.type === 'confusion')

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              markers,
              count: markers.length,
              summary: markers.length === 0
                ? 'No confusion markers found — content appears clear to the reader.'
                : `${markers.length} section${markers.length !== 1 ? 's' : ''} flagged as confusing.`,
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `get_confusion_markers failed: ${err.message}` }], isError: true }
      }
    }
  )
}
