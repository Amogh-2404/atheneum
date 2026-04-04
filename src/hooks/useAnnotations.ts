import { useState, useEffect, useCallback } from 'react'

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

const STORAGE_KEY = 'codex-annotations'

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

/* ─── Hook ─────────────────────────────────────────────────────────── */

export function useAnnotations(bookId?: string, chapterId?: string) {
  const [all, setAll] = useState<Annotation[]>(loadAnnotations)

  // Persist on every change
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
      setAll((prev) => [...prev, newA])
      return newA.id
    },
    []
  )

  const removeAnnotation = useCallback((id: string) => {
    setAll((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const updateAnnotation = useCallback(
    (id: string, updates: Partial<Omit<Annotation, 'id' | 'type' | 'createdAt'>>) => {
      setAll((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
      )
    },
    []
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
