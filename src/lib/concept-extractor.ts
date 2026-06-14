import type { TextContent } from '@/types'

// ─── Types ────────────────────────────────────────────────────────

export interface Concept {
  name: string
  definition: string
  bookId: string
  chapterId: string
  blockId: string
}

export interface ConceptIndex {
  concepts: Map<string, Concept>       // lowercase name -> definition
  references: Map<string, string[]>    // lowercase concept name -> [chapterId, ...]
}

// ─── Extractor ────────────────────────────────────────────────────

export function extractConcepts(bookId: string, chapters: any[]): ConceptIndex {
  const concepts = new Map<string, Concept>()
  const references = new Map<string, string[]>()

  for (const chapter of chapters) {
    if (!chapter?.blocks) continue
    for (const block of chapter.blocks) {
      // Extract definitions from definition callouts
      if (block.type === 'callout' && block.variant === 'definition') {
        const name = (block.title || '').toLowerCase().trim().replace(/[-_]/g, ' ')
        if (name) {
          concepts.set(name, {
            name: block.title,
            definition: extractPlainText(block.text),
            bookId,
            chapterId: chapter.id,
            blockId: block.id,
          })
        }
      }

      // Find [[concept]] references in text blocks
      const text = getBlockText(block)
      const refs = text.match(/\[\[([^\]]+)\]\]/g)
      if (refs) {
        for (const ref of refs) {
          const raw = ref.slice(2, -2).toLowerCase().trim()
          // Normalize: hyphens/underscores → spaces so [[discriminated-union]] matches "Discriminated Union"
          const normalized = raw.replace(/[-_]/g, ' ')
          for (const name of new Set([raw, normalized])) {
            if (!references.has(name)) references.set(name, [])
            const arr = references.get(name)!
            if (!arr.includes(chapter.id)) arr.push(chapter.id)
          }
        }
      }
    }
  }

  return { concepts, references }
}

// ─── Helpers ──────────────────────────────────────────────────────

function extractPlainText(content: TextContent | undefined): string {
  if (content == null) return ''
  let text = ''
  if (typeof content === 'string') text = content
  else if (Array.isArray(content)) text = content.map((s: any) => s.text || '').join('')
  // Strip [[concept]] markers — show as plain text in definitions/tooltips
  return text.replace(/\[\[([^\]]+)\]\]/g, '$1')
}

function getBlockText(block: any): string {
  if (block.text) return extractPlainText(block.text)
  if (block.code) return block.code
  // Also check list items, toggle content, etc.
  if (block.items) {
    return block.items.map((item: any) => extractPlainText(item.text)).join(' ')
  }
  if (block.title && block.type !== 'callout') {
    return extractPlainText(block.title)
  }
  return ''
}
