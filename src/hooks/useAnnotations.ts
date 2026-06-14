import { useState, useEffect, useCallback, useRef } from 'react'

/* ─── Types ────────────────────────────────────────────────────────── */

interface Highlight {
  id: string
  type: 'highlight'
  bookId: string
  chapterId: string
  blockId: string
  startOffset: number
  endOffset: number
  selectedText: string
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple'
  note?: string
  createdAt: string
}

interface Bookmark {
  id: string
  type: 'bookmark'
  bookId: string
  chapterId: string
  blockId: string
  label?: string
  createdAt: string
}

interface MarginNote {
  id: string
  type: 'margin-note'
  bookId: string
  chapterId: string
  blockId: string
  text: string
  createdAt: string
}

interface ConfusionMarker {
  id: string
  type: 'confusion'
  bookId: string
  chapterId: string
  blockId: string
  note?: string
  createdAt: string
}

type Annotation = Highlight | Bookmark | MarginNote | ConfusionMarker

/* ─── Storage ──────────────────────────────────────────────────────── */

const STORAGE_KEY = 'atheneum-annotations'

function loadAnnotations(): Annotation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveAnnotations(annotations: Annotation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(annotations))
}

/* ─── Server Sync Helpers ─────────────────────────────────────────── */

function syncAnnotationsToServer(bookId: string, annotations: Annotation[]) {
  const bookAnnotations = annotations.filter((a) => a.bookId === bookId)
  fetch(`/api/annotations/${bookId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ annotations: bookAnnotations }),
  }).catch(() => {
    // Fire-and-forget — server sync is best-effort
  })
}

function deleteAnnotationFromServer(bookId: string, annotationId: string) {
  fetch(`/api/annotations/${bookId}/${annotationId}`, {
    method: 'DELETE',
  }).catch(() => {
    // Fire-and-forget
  })
}

/* ─── Hook ─────────────────────────────────────────────────────────── */

export function useAnnotations(bookId?: string, chapterId?: string) {
  const [all, setAll] = useState<Annotation[]>(loadAnnotations)
  const hasFetchedRef = useRef<string | null>(null)

  // Fetch from server on mount (per bookId) and merge — server wins on ID conflict
  useEffect(() => {
    if (!bookId || hasFetchedRef.current === bookId) return
    hasFetchedRef.current = bookId

    fetch(`/api/annotations/${bookId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { annotations: Annotation[] }) => {
        const serverAnnotations = Array.isArray(data.annotations) ? data.annotations : []
        if (serverAnnotations.length === 0) return

        setAll((prev) => {
          // Build a map of server annotations by ID (server wins)
          const merged = new Map<string, Annotation>()
          // Start with all local annotations
          for (const a of prev) merged.set(a.id, a)
          // Overwrite / add server annotations (server wins on conflict)
          for (const a of serverAnnotations) merged.set(a.id, a)
          const result = Array.from(merged.values())
          saveAnnotations(result)
          return result
        })
      })
      .catch(() => {
        // Server unavailable — localStorage is the fallback
      })
  }, [bookId])

  // Persist to localStorage on every change
  useEffect(() => {
    saveAnnotations(all)
  }, [all])

  // Filter for current chapter
  const forChapter = all.filter(
    (a) => a.bookId === bookId && a.chapterId === chapterId
  )

  const highlights = forChapter.filter(
    (a): a is Highlight => a.type === 'highlight'
  )
  const bookmarks = forChapter.filter(
    (a): a is Bookmark => a.type === 'bookmark'
  )
  const marginNotes = forChapter.filter(
    (a): a is MarginNote => a.type === 'margin-note'
  )
  const confusionMarkers = forChapter.filter(
    (a): a is ConfusionMarker => a.type === 'confusion'
  )

  // All bookmarks across every chapter of this book (for sidebar)
  const allBookmarks = all.filter(
    (a): a is Bookmark => a.type === 'bookmark' && a.bookId === bookId
  )

  const addAnnotation = useCallback(
    (annotation: Omit<Annotation, 'id' | 'createdAt'>) => {
      const newA = {
        ...annotation,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      } as Annotation
      setAll((prev) => {
        const next = [...prev, newA]
        // Background sync to server
        if (bookId) syncAnnotationsToServer(bookId, next)
        return next
      })
      return newA.id
    },
    [bookId]
  )

  const removeAnnotation = useCallback((id: string) => {
    setAll((prev) => {
      const next = prev.filter((a) => a.id !== id)
      // Background sync: delete from server + push updated array
      if (bookId) {
        deleteAnnotationFromServer(bookId, id)
        syncAnnotationsToServer(bookId, next)
      }
      return next
    })
  }, [bookId])

  const updateAnnotation = useCallback(
    (id: string, updates: Partial<Omit<Annotation, 'id' | 'type' | 'createdAt'>>) => {
      setAll((prev) => {
        const next = prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
        // Background sync to server
        if (bookId) syncAnnotationsToServer(bookId, next)
        return next
      })
    },
    [bookId]
  )

  return {
    highlights,
    bookmarks,
    marginNotes,
    confusionMarkers,
    allBookmarks,
    addAnnotation,
    removeAnnotation,
    updateAnnotation,
  }
}

export type { Highlight, Bookmark, MarginNote, ConfusionMarker, Annotation }
