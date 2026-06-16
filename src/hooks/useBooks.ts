import { useState, useEffect, useCallback } from 'react'
import type { BookIndex } from '@/types'
import { fetchJSON } from '@/lib/api'

export function useBooks() {
  const [books, setBooks] = useState<BookIndex['books']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Exposed so mutations (archive/unarchive/delete) and error-retry can re-pull
  // the list in place — no full-page reload, no white flash.
  const refetch = useCallback(async () => {
    setError(null)
    try {
      const data = await fetchJSON<BookIndex>('/books')
      setBooks(data.books)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch books')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { books, loading, error, refetch }
}
