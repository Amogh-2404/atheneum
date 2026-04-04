import { useState, useEffect } from 'react'
import type { BookIndex } from '@/types'
import { fetchJSON } from '@/lib/api'

export function useBooks() {
  const [books, setBooks] = useState<BookIndex['books']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchJSON<BookIndex>('/books')
      .then((data) => {
        if (!cancelled) {
          setBooks(data.books)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch books')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [])

  return { books, loading, error }
}
