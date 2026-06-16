import FlexSearch from 'flexsearch'

interface SearchDoc {
  id: string           // "bookId/chapterId/blockId"
  bookId: string
  bookTitle: string
  chapterId: string
  chapterTitle: string
  chapterNumber: number
  blockId: string
  blockType: string
  text: string         // extracted plain text from the block
}

class SearchEngine {
  // @ts-ignore — FlexSearch types are unreliable
  private index: any
  private docs: Map<string, SearchDoc> = new Map()

  constructor() {
    // @ts-ignore — FlexSearch types are notoriously unreliable
    this.index = new FlexSearch.Index({
      tokenize: 'forward',
      resolution: 234, // ~2*floor(sqrt(14k)) — res:9 flattened ranking across the corpus
    })
  }

  addDoc(doc: SearchDoc) {
    this.docs.set(doc.id, doc)
    // @ts-ignore — FlexSearch typing doesn't like string ids but they work fine
    this.index.add(doc.id, doc.text)
  }

  search(query: string, limit = 20): SearchDoc[] {
    if (!query.trim()) return []
    // @ts-ignore
    const ids = this.index.search(query, { limit, suggest: true }) as string[]
    return ids.map(id => this.docs.get(String(id))).filter(Boolean) as SearchDoc[]
  }

  get size() {
    return this.docs.size
  }

  clear() {
    this.docs.clear()
    // @ts-ignore
    this.index = new FlexSearch.Index({ tokenize: 'forward', resolution: 234 })
  }
}

export const searchEngine = new SearchEngine()
export type { SearchDoc }

// Helper to extract plain text from a TextContent (string or RichText array)
export function extractText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map((seg: Record<string, unknown>) => seg.text || '').join('')
  }
  return ''
}

// Index all blocks from a chapter
export function indexChapter(bookId: string, bookTitle: string, chapter: Record<string, unknown>) {
  const blocks = chapter.blocks as Record<string, unknown>[] | undefined
  if (!blocks) return
  for (const block of blocks) {
    let text = ''
    switch (block.type) {
      case 'heading': text = extractText(block.text); break
      case 'text': text = extractText(block.text); break
      case 'callout': text = `${block.title || ''} ${extractText(block.text)}`; break
      case 'code': text = `${block.filename || ''} ${block.code}`; break
      case 'quote': text = extractText(block.text); break
      case 'list': text = flattenList(block.items as Record<string, unknown>[]); break
      case 'summary': {
        const points = block.points as unknown[] | undefined
        text = points?.map((p: unknown) => extractText(p)).join(' ') || ''
        break
      }
      case 'math': text = (block.expression as string) || ''; break
      default: text = extractText(block.text) || ''
    }
    if (text.trim()) {
      searchEngine.addDoc({
        id: `${bookId}/${chapter.id}/${block.id}`,
        bookId,
        bookTitle,
        chapterId: chapter.id as string,
        chapterTitle: chapter.title as string,
        chapterNumber: chapter.number as number,
        blockId: block.id as string,
        blockType: block.type as string,
        text: text.trim(),
      })
    }
  }
}

function flattenList(items: Record<string, unknown>[]): string {
  if (!items) return ''
  return items.map((item: Record<string, unknown>) => {
    const t = extractText(item.text)
    const children = item.children ? flattenList(item.children as Record<string, unknown>[]) : ''
    return `${t} ${children}`
  }).join(' ')
}
