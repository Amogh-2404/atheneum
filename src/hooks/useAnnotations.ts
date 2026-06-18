import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { annotationStore } from '@/stores/annotationStore'
import type { Annotation, Highlight, Bookmark, MarginNote, ConfusionMarker } from '@/stores/annotationStore'

/**
 * Thin selector hook over the single reactive annotation store. Public API is
 * byte-identical to before — Reader, AnnotationToolbar, and AnnotationNotebook keep
 * calling the same names — but every caller now reads the SAME live source, so an add
 * in the Reader appears in the Notebook (and a delete in the Notebook removes the
 * Reader's overlay) instantly. The old per-component useState (which made the renderer
 * repaint every render and the Notebook a dead snapshot) is gone.
 */
export function useAnnotations(bookId?: string, chapterId?: string) {
  const all = useSyncExternalStore(annotationStore.subscribe, annotationStore.getSnapshot)

  // Hydrate this book from the server once (store-level guard makes it idempotent).
  useEffect(() => {
    if (bookId) annotationStore.hydrate(bookId)
  }, [bookId])

  const forChapter = useMemo(
    () => all.filter((a) => a.bookId === bookId && a.chapterId === chapterId),
    [all, bookId, chapterId],
  )
  const highlights = useMemo(
    () => forChapter.filter((a): a is Highlight => a.type === 'highlight'),
    [forChapter],
  )
  const bookmarks = useMemo(
    () => forChapter.filter((a): a is Bookmark => a.type === 'bookmark'),
    [forChapter],
  )
  const marginNotes = useMemo(
    () => forChapter.filter((a): a is MarginNote => a.type === 'margin-note'),
    [forChapter],
  )
  const confusionMarkers = useMemo(
    () => forChapter.filter((a): a is ConfusionMarker => a.type === 'confusion'),
    [forChapter],
  )
  // All bookmarks across every chapter of this book (for the sidebar).
  const allBookmarks = useMemo(
    () => all.filter((a): a is Bookmark => a.type === 'bookmark' && a.bookId === bookId),
    [all, bookId],
  )

  return {
    highlights,
    bookmarks,
    marginNotes,
    confusionMarkers,
    allBookmarks,
    addAnnotation: annotationStore.add,
    addAnnotationSynced: annotationStore.addSynced,
    removeAnnotation: annotationStore.remove,
    updateAnnotation: annotationStore.update,
  }
}

export type { Highlight, Bookmark, MarginNote, ConfusionMarker, Annotation }
