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
        const chapters = await Promise.all(
          (book.chapters || []).map((ch: any) =>
            fetchJSON<any>(`/books/${bookId}/chapters/${ch.id}`)
          )
        )
        if (!cancelled) {
          const index = extractConcepts(bookId!, chapters)
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
