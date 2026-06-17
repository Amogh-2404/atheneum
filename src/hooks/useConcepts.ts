import { useState, useEffect } from 'react'
import { fetchJSON } from '@/lib/api'
import { extractConcepts, type ConceptIndex } from '@/lib/concept-extractor'

export function useConcepts(bookId: string | undefined) {
  const [conceptIndex, setConceptIndex] = useState<ConceptIndex | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!bookId) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function build() {
      try {
        const book = await fetchJSON<any>(`/books/${bookId}`)
        // Fetch chapters AND the outline (the graph data) in parallel. A missing
        // outline (older book / 404) degrades to definition-only tooltips, never
        // an error — so the hovercard keeps working for un-graphed books.
        const [chapters, outline] = await Promise.all([
          Promise.all(
            (book.chapters || []).map((ch: any) =>
              fetchJSON<any>(`/books/${bookId}/chapters/${ch.id}`)
            )
          ),
          fetchJSON<any>(`/books/${bookId}/outline`).catch(() => undefined),
        ])
        if (!cancelled) {
          const index = extractConcepts(bookId!, chapters, outline)
          setConceptIndex(index)
          setLoading(false)
        }
      } catch (err) {
        console.error('[useConcepts] Failed to build concept index:', err)
        if (!cancelled) setLoading(false)
      }
    }

    build()
    return () => { cancelled = true }
  }, [bookId])

  return { conceptIndex, loading }
}
