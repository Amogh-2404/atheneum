import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import path from 'path'
import { existsSync, readdirSync } from 'fs'
import { safeReadJSON } from './lib/file-ops.js'

const BLOCK_SCHEMA_DOC = `# Atheneum Block Types Reference

Atheneum uses 18 typed content blocks. Every block has:
- \`id\`: Unique string (format: "blk_xxxxx")
- \`type\`: Block type discriminator
- \`status\`: "draft" | "published"
- \`metadata\`: { createdAt?, updatedAt?, insertedAfter?, movedFrom? }

## Block Types

### 1. heading
\`{ type: "heading", level: 1|2|3, text: TextContent, anchor?: string }\`

### 2. text
\`{ type: "text", text: TextContent }\`

### 3. callout
\`{ type: "callout", variant: "tip"|"warning"|"key-concept"|"example"|"definition"|"note", title?: string, text: TextContent, icon?: string }\`

### 4. code
\`{ type: "code", language: string, code: string, filename?: string, highlightLines?: number[], annotations?: Record<lineNum, string>, showLineNumbers?: boolean }\`

### 5. diagram
\`{ type: "diagram", diagramFile?: string, inlineData?: ExcalidrawJSON, caption?: TextContent, width?: "narrow"|"medium"|"full"|"wide" }\`

### 6. figure
\`{ type: "figure", src: string, alt: string, caption?: TextContent, layout: "full"|"left"|"right"|"center", width?: string }\`

### 7. quote
\`{ type: "quote", text: TextContent, attribution?: string, source?: string }\`

### 8. list
\`{ type: "list", style: "ordered"|"unordered", items: ListItem[] }\`
ListItem: \`{ text: TextContent, children?: ListItem[] }\`

### 9. divider
\`{ type: "divider", style?: "line"|"dots"|"wave"|"flourish" }\`

### 10. math
\`{ type: "math", expression: string (LaTeX), display?: boolean }\`

### 11. table
\`{ type: "table", headers: TextContent[], rows: TextContent[][], caption?: string }\`

### 12. toggle
\`{ type: "toggle", title: TextContent, content: Block[] }\` (recursive — content is any block type)

### 13. timeline
\`{ type: "timeline", events: Array<{ title: TextContent, description?: TextContent, icon?: string }> }\`

### 14. quiz
\`{ type: "quiz", questions: Array<{ id: string, question: TextContent, options: TextContent[], correctIndex: number, explanation: TextContent }> }\`

### 15. flashcard
\`{ type: "flashcard", cards: Array<{ front: TextContent, back: TextContent, category?: string }> }\`

### 16. summary
\`{ type: "summary", points: TextContent[] }\`

### 17. embed
\`{ type: "embed", url: string, title?: string, description?: string }\`

### 18. margin-annotation
\`{ type: "margin-annotation", text: TextContent, author?: string }\`

## TextContent Format
Either a plain string (supports **bold**, *italic*, \\\`code\\\`, [[concept]], [link](url))
OR a RichText array:
\`[{ text: "normal" }, { text: "bold", annotations: { bold: true } }, { text: "colored", annotations: { color: "#52FEFE" } }]\`

## Block ID Format
\`blk_\` followed by 5 random alphanumeric characters (e.g., \`blk_a3f9k\`).
`

export function registerResources(server: McpServer, contentDir: string) {

  // ─── Static: Library Index ───────────────────────────────────────
  server.resource(
    'library-index',
    'atheneum://library',
    { mimeType: 'application/json', description: 'Complete list of all books in the library with metadata' },
    async () => {
      const indexPath = path.join(contentDir, '_index.json')
      const data = await safeReadJSON(indexPath)

      if (data) {
        return { contents: [{ uri: 'atheneum://library', mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] }
      }

      // Fallback: scan directories
      const books: any[] = []
      if (existsSync(contentDir)) {
        for (const entry of readdirSync(contentDir, { withFileTypes: true })) {
          if (entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')) {
            const book = await safeReadJSON(path.join(contentDir, entry.name, 'book.json'))
            if (book) books.push({ id: book.id ?? entry.name, title: book.title ?? entry.name })
          }
        }
      }

      return { contents: [{ uri: 'atheneum://library', mimeType: 'application/json', text: JSON.stringify({ books }, null, 2) }] }
    }
  )

  // ─── Static: Block Schema Reference ──────────────────────────────
  server.resource(
    'block-schema',
    'atheneum://schema/blocks',
    { mimeType: 'text/markdown', description: 'Documentation of all 18 block types with schemas and examples' },
    async () => {
      return { contents: [{ uri: 'atheneum://schema/blocks', mimeType: 'text/markdown', text: BLOCK_SCHEMA_DOC }] }
    }
  )

  // ─── Dynamic: Book Detail ────────────────────────────────────────
  server.resource(
    'book-detail',
    'atheneum://books/{bookId}',
    { mimeType: 'application/json', description: 'Book metadata and chapter listing' },
    async (uri) => {
      const match = uri.href.match(/^atheneum:\/\/books\/([^/]+)$/)
      if (!match) return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'Invalid URI' }] }

      const bookId = match[1]
      const bookPath = path.join(contentDir, bookId, 'book.json')
      const book = await safeReadJSON(bookPath)

      if (!book) return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: `Book "${bookId}" not found` }] }

      const chaptersDir = path.join(contentDir, bookId, 'chapters')
      const chapters: any[] = []
      if (existsSync(chaptersDir)) {
        for (const f of readdirSync(chaptersDir).filter(f => f.endsWith('.json')).sort()) {
          const ch = await safeReadJSON(path.join(chaptersDir, f))
          if (ch) chapters.push({ id: ch.id, number: ch.number, title: ch.title, blockCount: ch.blockCount })
        }
      }

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({ ...book, chapters }, null, 2),
        }],
      }
    }
  )

  // ─── Dynamic: Book Outline ───────────────────────────────────────
  server.resource(
    'book-outline',
    'atheneum://books/{bookId}/outline',
    { mimeType: 'application/json', description: 'Book outline with planned chapters, concept index, prerequisites' },
    async (uri) => {
      const match = uri.href.match(/^atheneum:\/\/books\/([^/]+)\/outline$/)
      if (!match) return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'Invalid URI' }] }

      const outline = await safeReadJSON(path.join(contentDir, match[1], 'outline.json'))
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(outline ?? { chapters: [], conceptIndex: {} }, null, 2),
        }],
      }
    }
  )

  // ─── Dynamic: Chapter Content ────────────────────────────────────
  server.resource(
    'chapter-content',
    'atheneum://books/{bookId}/chapters/{chapterId}',
    { mimeType: 'application/json', description: 'Full chapter content with all blocks' },
    async (uri) => {
      const match = uri.href.match(/^atheneum:\/\/books\/([^/]+)\/chapters\/([^/]+)$/)
      if (!match) return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'Invalid URI' }] }

      const chapter = await safeReadJSON(path.join(contentDir, match[1], 'chapters', `${match[2]}.json`))
      if (!chapter) return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'Chapter not found' }] }

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(chapter, null, 2),
        }],
      }
    }
  )

  // ─── Dynamic: Book Annotations ───────────────────────────────────
  server.resource(
    'book-annotations',
    'atheneum://books/{bookId}/annotations',
    { mimeType: 'application/json', description: 'User annotations (highlights, bookmarks, notes, confusion markers)' },
    async (uri) => {
      const match = uri.href.match(/^atheneum:\/\/books\/([^/]+)\/annotations$/)
      if (!match) return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'Invalid URI' }] }

      const data = await safeReadJSON(path.join(contentDir, match[1], '.annotations', 'annotations.json'))
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(data ?? { annotations: [] }, null, 2),
        }],
      }
    }
  )

  // ─── Dynamic: Confusion Markers ──────────────────────────────────
  server.resource(
    'confusion-markers',
    'atheneum://books/{bookId}/confusion',
    { mimeType: 'application/json', description: 'Confusion markers — sections flagged as needing improvement' },
    async (uri) => {
      const match = uri.href.match(/^atheneum:\/\/books\/([^/]+)\/confusion$/)
      if (!match) return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: 'Invalid URI' }] }

      const data = await safeReadJSON(path.join(contentDir, match[1], '.annotations', 'annotations.json'))
      const markers = (data?.annotations ?? []).filter((a: any) => a.type === 'confusion')

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({ markers, count: markers.length }, null, 2),
        }],
      }
    }
  )
}
