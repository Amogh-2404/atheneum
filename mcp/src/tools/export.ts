import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import path from 'path'
import { existsSync, readdirSync } from 'fs'
import { sanitizeId, safePath } from '../../../server/utils.js'
import { safeReadJSON } from '../lib/file-ops.js'
import { extractText } from '../lib/block-utils.js'

// ─── Markdown conversion (ported from src/lib/markdown-export.ts) ──

function textToMd(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((seg: any) => {
      let t: string = seg.text ?? ''
      if (seg.annotations?.bold) t = `**${t}**`
      if (seg.annotations?.italic) t = `*${t}*`
      if (seg.annotations?.code) t = '`' + t + '`'
      if (seg.annotations?.strikethrough) t = `~~${t}~~`
      if (seg.href) t = `[${t}](${seg.href})`
      return t
    }).join('')
  }
  return String(content ?? '')
}

function listToMd(items: any[], style: string, depth = 0): string {
  if (!items) return ''
  return items.map((item: any, i: number) => {
    const prefix = style === 'ordered' ? `${i + 1}.` : '-'
    const indent = '  '.repeat(depth)
    let line = `${indent}${prefix} ${textToMd(item.text)}`
    if (item.children) line += '\n' + listToMd(item.children, style, depth + 1)
    return line
  }).join('\n')
}

function tableToMd(headers: any[], rows: any[][]): string {
  const headerLine = '| ' + headers.map((h: any) => textToMd(h)).join(' | ') + ' |'
  const separator = '| ' + headers.map(() => '---').join(' | ') + ' |'
  const bodyLines = rows.map((row: any[]) => '| ' + row.map((c: any) => textToMd(c)).join(' | ') + ' |')
  return [headerLine, separator, ...bodyLines].join('\n')
}

function blockToMarkdown(block: any): string {
  switch (block.type) {
    case 'heading':
      return `${'#'.repeat(block.level ?? 2)} ${textToMd(block.text)}`
    case 'text':
      return textToMd(block.text)
    case 'callout':
      return `> **${(block.variant ?? 'note').toUpperCase()}${block.title ? ': ' + block.title : ''}**\n> ${textToMd(block.text)}`
    case 'code':
      return '```' + (block.language || '') + '\n' + (block.code ?? '') + '\n```'
    case 'quote':
      return `> ${textToMd(block.text)}${block.attribution ? '\n> \u2014 ' + block.attribution : ''}`
    case 'list':
      return listToMd(block.items, block.style)
    case 'divider':
      return '---'
    case 'math':
      return `$$\n${block.expression ?? ''}\n$$`
    case 'summary':
      return `**Key Takeaways:**\n${(block.points || []).map((p: any) => '- ' + textToMd(p)).join('\n')}`
    case 'table':
      return tableToMd(block.headers ?? [], block.rows ?? [])
    case 'timeline':
      return (block.events ?? [])
        .map((ev: any) => `- **${textToMd(ev.title)}**${ev.description ? ': ' + textToMd(ev.description) : ''}`)
        .join('\n')
    case 'toggle':
      return `<details>\n<summary>${textToMd(block.title)}</summary>\n\n${(block.content ?? []).map((b: any) => blockToMarkdown(b)).join('\n\n')}\n</details>`
    case 'figure':
      return `![${block.alt ?? ''}](${block.src ?? ''})${block.caption ? '\n*' + textToMd(block.caption) + '*' : ''}`
    case 'embed':
      return `[${block.title || block.url}](${block.url ?? ''})`
    case 'margin-annotation':
      return `> *Note:* ${textToMd(block.text)}`
    case 'quiz':
      return (block.questions ?? []).map((q: any, i: number) =>
        `**Q${i + 1}:** ${textToMd(q.question)}\n${(q.options ?? []).map((o: any, j: number) =>
          `  ${j === q.correctIndex ? '**' : ''}${String.fromCharCode(65 + j)}) ${textToMd(o)}${j === q.correctIndex ? '**' : ''}`
        ).join('\n')}\n  *${textToMd(q.explanation)}*`
      ).join('\n\n')
    case 'flashcard':
      return (block.cards ?? []).map((c: any) =>
        `- **Q:** ${textToMd(c.front)}\n  **A:** ${textToMd(c.back)}`
      ).join('\n')
    default:
      return ''
  }
}

function chapterToMarkdown(chapter: any): string {
  const lines: string[] = []
  lines.push(`# ${chapter.title ?? 'Untitled'}`)
  if (chapter.subtitle) lines.push(`*${chapter.subtitle}*`)
  lines.push('')

  for (const block of (chapter.blocks ?? [])) {
    const md = blockToMarkdown(block)
    if (md) {
      lines.push(md)
      lines.push('')
    }
  }

  return lines.join('\n')
}

// ─── Tool registration ─────────────────────────────────────────────

export function registerExportTools(server: McpServer, contentDir: string) {

  server.tool(
    'export_markdown',
    'Export a chapter or entire book as Markdown. Read-only operation.',
    {
      bookId: z.string(),
      chapterId: z.string().optional().describe('Omit to export entire book'),
    },
    async ({ bookId, chapterId }) => {
      try {
        const cleanBook = sanitizeId(bookId)
        if (!cleanBook) return { content: [{ type: 'text' as const, text: `export_markdown failed: invalid bookId` }], isError: true }

        // Single chapter export
        if (chapterId) {
          const cleanChapter = sanitizeId(chapterId)
          if (!cleanChapter) return { content: [{ type: 'text' as const, text: `export_markdown failed: invalid chapterId` }], isError: true }

          const chapterPath = safePath(contentDir, cleanBook, 'chapters', `${cleanChapter}.json`)
          if (!chapterPath) return { content: [{ type: 'text' as const, text: `export_markdown failed: path traversal` }], isError: true }

          const chapter = await safeReadJSON(chapterPath)
          if (!chapter) return { content: [{ type: 'text' as const, text: `export_markdown failed: chapter not found` }], isError: true }

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                title: chapter.title,
                markdown: chapterToMarkdown(chapter),
              }, null, 2),
            }],
          }
        }

        // Full book export
        const bookDir = safePath(contentDir, cleanBook)
        if (!bookDir || !existsSync(bookDir)) {
          return { content: [{ type: 'text' as const, text: `export_markdown failed: book not found` }], isError: true }
        }

        const bookJson = await safeReadJSON(path.join(bookDir, 'book.json'))
        const bookTitle = bookJson?.title ?? cleanBook

        const chaptersDir = path.join(bookDir, 'chapters')
        if (!existsSync(chaptersDir)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ title: bookTitle, markdown: `# ${bookTitle}\n\n*No chapters yet.*` }) }] }
        }

        const files = readdirSync(chaptersDir).filter(f => f.endsWith('.json')).sort()
        const parts: string[] = [`# ${bookTitle}`]
        if (bookJson?.subtitle) parts.push(`*${bookJson.subtitle}*`)
        parts.push('')

        for (const file of files) {
          const chapter = await safeReadJSON(path.join(chaptersDir, file))
          if (chapter) {
            parts.push(chapterToMarkdown(chapter))
            parts.push('---\n')
          }
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              title: bookTitle,
              chapters: files.length,
              markdown: parts.join('\n'),
            }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `export_markdown failed: ${err.message}` }], isError: true }
      }
    }
  )
}
