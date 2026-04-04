import { randomBytes } from 'crypto'

/**
 * Generate a unique block ID in the format blk_xxxxx (5 random alphanumeric chars).
 */
export function generateBlockId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = randomBytes(5)
  let id = 'blk_'
  for (let i = 0; i < 5; i++) {
    id += chars[bytes[i] % chars.length]
  }
  return id
}

/**
 * Extract plain text from a TextContent value (string or RichText array).
 */
export function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((seg: any) => seg.text || '').join('')
  }
  return ''
}

/**
 * Recursively flatten list items into plain text.
 */
function flattenList(items: any[]): string {
  if (!items) return ''
  return items.map((item: any) => {
    const t = extractText(item.text)
    const children = item.children ? flattenList(item.children) : ''
    return `${t} ${children}`
  }).join(' ')
}

/**
 * Extract searchable text from a block (covers all 18 types).
 */
export function extractBlockText(block: any): string {
  switch (block.type) {
    case 'heading':
    case 'text':
    case 'quote':
    case 'margin-annotation':
      return extractText(block.text)

    case 'callout':
      return `${block.title || ''} ${extractText(block.text)}`

    case 'code':
      return `${block.filename || ''} ${block.code || ''}`

    case 'list':
      return flattenList(block.items)

    case 'summary':
      return (block.points || []).map((p: unknown) => extractText(p)).join(' ')

    case 'math':
      return block.expression || ''

    case 'table': {
      const headers = (block.headers || []).map((h: unknown) => extractText(h)).join(' ')
      const rows = (block.rows || []).map((row: any[]) =>
        row.map((cell: unknown) => extractText(cell)).join(' ')
      ).join(' ')
      return `${headers} ${rows}`
    }

    case 'quiz':
      return (block.questions || []).map((q: any) =>
        `${extractText(q.question)} ${(q.options || []).map((o: unknown) => extractText(o)).join(' ')} ${extractText(q.explanation)}`
      ).join(' ')

    case 'flashcard':
      return (block.cards || []).map((c: any) =>
        `${extractText(c.front)} ${extractText(c.back)}`
      ).join(' ')

    case 'timeline':
      return (block.events || []).map((ev: any) =>
        `${extractText(ev.title)} ${extractText(ev.description || '')}`
      ).join(' ')

    case 'toggle':
      // Recursive: extract from nested content blocks
      return `${extractText(block.title)} ${(block.content || []).map((b: any) => extractBlockText(b)).join(' ')}`

    case 'diagram':
      return extractText(block.caption || '')

    case 'figure':
      return `${block.alt || ''} ${extractText(block.caption || '')}`

    case 'embed':
      return `${block.title || ''} ${block.description || ''}`

    case 'divider':
      return ''

    default:
      return extractText(block.text) || ''
  }
}

/**
 * Count words in a string.
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Calculate estimated read time in minutes (~200 wpm).
 */
export function calcReadTime(blocks: any[]): number {
  const totalWords = blocks.reduce((sum: number, block: any) => {
    return sum + countWords(extractBlockText(block))
  }, 0)
  return Math.max(1, Math.round(totalWords / 200))
}

/**
 * Ensure all blocks have unique IDs within a chapter.
 * Auto-generates IDs for blocks missing them.
 * Returns warnings for any duplicates that were fixed.
 */
export function ensureBlockIds(blocks: any[]): { blocks: any[]; warnings: string[] } {
  const warnings: string[] = []
  const seenIds = new Set<string>()

  const processed = blocks.map((block: any, index: number) => {
    // Auto-generate if missing
    if (!block.id) {
      block.id = generateBlockId()
    }

    // Fix duplicates
    if (seenIds.has(block.id)) {
      const oldId = block.id
      block.id = generateBlockId()
      warnings.push(`Block at index ${index} had duplicate ID "${oldId}", reassigned to "${block.id}"`)
    }

    seenIds.add(block.id)
    return block
  })

  return { blocks: processed, warnings }
}
