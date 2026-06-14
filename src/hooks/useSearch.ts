import { useState, useEffect, useCallback } from 'react'
import { searchEngine, indexChapter } from '@/lib/search-index'
import { fetchJSON } from '@/lib/api'

interface SearchResult {
  id: string
  bookId: string
  bookTitle: string
  chapterId: string
  chapterTitle: string
  chapterNumber: number
  blockId: string
  blockType: string
  text: string
  snippet: string     // text with query match position markers
}

export type { SearchResult }

export function useSearch() {
  const [indexed, setIndexed] = useState(false)
  const [indexing, setIndexing] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [query, setQuery] = useState('')

  // Build index on first use
  useEffect(() => {
    // Don't re-index if already done
    if (searchEngine.size > 0) {
      setIndexed(true)
      return
    }

    let cancelled = false

    async function buildIndex() {
      setIndexing(true)
      try {
        const data = await fetchJSON<Record<string, unknown>>('/books')
        const books = (data.books || []) as Record<string, unknown>[]
        for (const book of books) {
          if (cancelled) return
          try {
            const fullBook = await fetchJSON<Record<string, unknown>>(`/books/${book.id}`)
            const chapters = (fullBook.chapters || []) as Record<string, unknown>[]
            for (const ch of chapters) {
              if (cancelled) return
              try {
                const chapter = await fetchJSON<Record<string, unknown>>(`/books/${book.id}/chapters/${ch.id}`)
                indexChapter(book.id as string, book.title as string, chapter)
              } catch {
                // Skip chapters that fail to load — don't break the whole index
              }
            }
          } catch {
            // Skip books that fail to load
          }
        }
        if (!cancelled) setIndexed(true)
      } catch (e) {
        console.error('Search indexing failed:', e)
      } finally {
        if (!cancelled) setIndexing(false)
      }
    }
    buildIndex()

    return () => { cancelled = true }
  }, [])

  const search = useCallback((q: string) => {
    setQuery(q)
    if (!q.trim()) { setResults([]); return }
    const raw = searchEngine.search(q, 20)
    const withSnippets: SearchResult[] = raw.map(doc => ({
      ...doc,
      snippet: createSnippet(doc.text, q),
    }))
    setResults(withSnippets)
  }, [])

  return { results, query, search, indexed, indexing }
}

function createSnippet(text: string, query: string): string {
  const lower = text.toLowerCase()
  const qLower = query.toLowerCase()
  const idx = lower.indexOf(qLower)
  if (idx === -1) return text.slice(0, 120) + (text.length > 120 ? '...' : '')
  const start = Math.max(0, idx - 40)
  const end = Math.min(text.length, idx + query.length + 60)
  let snippet = ''
  if (start > 0) snippet += '...'
  snippet += text.slice(start, end)
  if (end < text.length) snippet += '...'
  return snippet
}
