import { useState, useEffect } from 'react'
import type { Book } from '@/types'
import { fetchJSON } from '@/lib/api'
import { useWS } from '@/providers/WebSocketProvider'

export function useBook(bookId: string | undefined) {
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { client } = useWS()

  // Initial REST fetch
  useEffect(() => {
    if (!bookId) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchJSON<Book>(`/books/${bookId}`)
      .then((data) => {
        if (!cancelled) {
          setBook(data)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch book')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [bookId])

  // WebSocket live updates
  useEffect(() => {
    if (!client || !bookId) return

    client.subscribe(bookId)

    const off = client.on('book-updated', (msg: any) => {
      if (msg.bookId === bookId) {
        setBook(msg.book)
      }
    })

    return () => {
      off()
      client.unsubscribe(bookId)
    }
  }, [client, bookId])

  return { book, loading, error }
}
