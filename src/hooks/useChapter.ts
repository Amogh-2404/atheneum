import { useState, useEffect } from 'react'
import { fetchJSON } from '@/lib/api'
import { useWS } from '@/providers/WebSocketProvider'
import type { Chapter } from '@/types'

export function useChapter(bookId: string | undefined, chapterId: string | undefined) {
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { client } = useWS()

  // Initial REST fetch
  useEffect(() => {
    if (!bookId || !chapterId) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetchJSON<Chapter>(`/books/${bookId}/chapters/${chapterId}`)
      .then((data) => {
        if (!cancelled) {
          setChapter(data)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch chapter')
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [bookId, chapterId])

  // WebSocket live updates
  useEffect(() => {
    if (!client || !bookId || !chapterId) return

    client.subscribe(bookId, chapterId)

    const off = client.on('chapter-updated', (msg: any) => {
      if (msg.bookId === bookId && msg.chapterId === chapterId) {
        setChapter(msg.chapter)
      }
    })

    return () => {
      off()
      client.unsubscribe(bookId)
    }
  }, [client, bookId, chapterId])

  return { chapter, loading, error }
}
