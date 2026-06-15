import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useBook } from '@/hooks/useBook'
import { useAnnotations } from '@/hooks/useAnnotations'
import type { Annotation, Highlight, Bookmark, MarginNote, ConfusionMarker } from '@/hooks/useAnnotations'
import { SkeletonBlock, ShimmerStyle } from '@/components/shared/Skeleton'
import ErrorState from '@/components/shared/ErrorState'

type FilterType = 'all' | 'highlight' | 'bookmark' | 'margin-note' | 'confusion'
type SortBy = 'chapter' | 'date'

const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'highlight', label: 'Highlights' },
  { key: 'bookmark', label: 'Bookmarks' },
  { key: 'margin-note', label: 'Notes' },
  { key: 'confusion', label: 'Confusion' },
]

const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: '#fde68a',
  green: '#86efac',
  blue: '#93c5fd',
  pink: '#f9a8d4',
  purple: '#c4b5fd',
}

export default function AnnotationNotebook() {
  const { bookId } = useParams()
  const { book, loading, error } = useBook(bookId)
  // Called for its side effect: syncs this book's annotations from the server into
  // localStorage, which allBookAnnotations (below) reads directly across all chapters.
  useAnnotations(bookId)
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortBy, setSortBy] = useState<SortBy>('chapter')

  // Get all annotations for this book (not chapter-filtered, not type-filtered) —
  // the single source the filtered view and the per-type counts both derive from.
  const bookAnnotations = useMemo(() => {
    try {
      const raw = localStorage.getItem('atheneum-annotations')
      if (!raw) return []
      const all: Annotation[] = JSON.parse(raw)
      return all.filter(a => a.bookId === bookId)
    } catch { return [] }
  }, [bookId])

  // Per-type counts for the filter pills (count is independent of the active filter)
  const typeCounts = useMemo(() => {
    const counts: Record<FilterType, number> = {
      all: bookAnnotations.length,
      highlight: 0,
      bookmark: 0,
      'margin-note': 0,
      confusion: 0,
    }
    for (const a of bookAnnotations) {
      if (a.type in counts) counts[a.type as FilterType]++
    }
    return counts
  }, [bookAnnotations])

  // Active-filter view
  const allBookAnnotations = useMemo(() => {
    if (filter === 'all') return bookAnnotations
    return bookAnnotations.filter(a => a.type === filter)
  }, [bookAnnotations, filter])

  // Sort
  const sorted = useMemo(() => {
    const items = [...allBookAnnotations]
    if (sortBy === 'date') {
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } else {
      items.sort((a, b) => a.chapterId.localeCompare(b.chapterId))
    }
    return items
  }, [allBookAnnotations, sortBy])

  // Group by chapter
  const grouped = useMemo(() => {
    if (sortBy !== 'chapter') return null
    const groups = new Map<string, Annotation[]>()
    for (const a of sorted) {
      const list = groups.get(a.chapterId) ?? []
      list.push(a)
      groups.set(a.chapterId, list)
    }
    return groups
  }, [sorted, sortBy])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--chrome-bg)', padding: '3rem 2rem' }}>
      <ShimmerStyle />
      <div style={{ maxWidth: 700, margin: '0 auto' }}><SkeletonBlock lines={4} /><SkeletonBlock lines={3} /></div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--chrome-bg)' }}>
      <ErrorState message={error} icon="error" onRetry={() => window.location.reload()} />
    </div>
  )

  if (!book) return null

  const formatChapterId = (id: string) => {
    const slug = id.replace(/^\d+-/, '')
    return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  const renderAnnotation = (a: Annotation) => {
    const link = `/book/${bookId}/${a.chapterId}#${a.blockId}`
    return (
      <Link
        key={a.id}
        to={link}
        style={{
          display: 'block',
          padding: '0.6rem 0.75rem',
          borderRadius: 6,
          border: '1px solid var(--chrome-border)',
          textDecoration: 'none',
          transition: 'border-color 200ms, background 150ms',
          marginBottom: 6,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--chrome-accent)'; e.currentTarget.style.background = 'rgba(82,254,254,0.03)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--chrome-border)'; e.currentTarget.style.background = 'transparent' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {/* Type indicator */}
          {a.type === 'highlight' && (
            <span style={{ width: 10, height: 10, borderRadius: 2, background: HIGHLIGHT_COLORS[(a as Highlight).color] || '#fde68a', flexShrink: 0 }} />
          )}
          {a.type === 'bookmark' && <span style={{ fontSize: '0.8rem' }}>&#128278;</span>}
          {a.type === 'margin-note' && <span style={{ fontSize: '0.8rem' }}>&#128221;</span>}
          {a.type === 'confusion' && <span style={{ fontSize: '0.8rem' }}>&#10067;</span>}

          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--chrome-text)', opacity: 0.5, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {a.type === 'margin-note' ? 'Note' : a.type}
          </span>

          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-ui)', fontSize: '0.65rem', color: 'var(--ink-faint)' }}>
            {new Date(a.createdAt).toLocaleDateString()}
          </span>
        </div>

        {/* Content */}
        {a.type === 'highlight' && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--chrome-text)', lineHeight: 1.5 }}>
            <div style={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              overflowWrap: 'anywhere',
            }}>
              &ldquo;{(a as Highlight).selectedText}&rdquo;
            </div>
            {(a as Highlight).note && (
              <div style={{ marginTop: 4, fontSize: '0.8rem', color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                {(a as Highlight).note}
              </div>
            )}
          </div>
        )}
        {a.type === 'bookmark' && (a as Bookmark).label && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--chrome-text)' }}>
            {(a as Bookmark).label}
          </div>
        )}
        {a.type === 'margin-note' && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--chrome-text)', lineHeight: 1.5 }}>
            {(a as MarginNote).text}
          </div>
        )}
        {a.type === 'confusion' && (a as ConfusionMarker).note && (
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--chrome-text)' }}>
            {(a as ConfusionMarker).note}
          </div>
        )}
      </Link>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--chrome-bg)', padding: '2rem' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--chrome-border)' }}>
          <Link to={`/book/${bookId}`} style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--chrome-muted, var(--ink-faint))', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            &larr; {book.title}
          </Link>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.3rem', fontWeight: 700, color: 'var(--chrome-accent)', margin: '4px 0 0', lineHeight: 1.1 }}>
            Annotation Notebook
          </h1>
        </div>

        {/* Filters + Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {FILTER_OPTIONS.map(f => {
            const count = typeCounts[f.key]
            const isActive = filter === f.key
            // A non-"all" filter with zero matches leads to an identical empty state — disable it.
            const isEmpty = f.key !== 'all' && count === 0
            return (
              <button
                key={f.key}
                type="button"
                disabled={isEmpty}
                onClick={() => { if (!isEmpty) setFilter(f.key) }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.75rem',
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? 'var(--chrome-accent)' : 'var(--chrome-text)',
                  background: isActive ? 'rgba(82,254,254,0.08)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--chrome-accent)' : 'var(--chrome-border)'}`,
                  borderRadius: 4,
                  padding: '4px 10px',
                  cursor: isEmpty ? 'not-allowed' : 'pointer',
                  opacity: isEmpty ? 0.35 : 1,
                  transition: 'all 150ms',
                }}
                onMouseEnter={(e) => {
                  if (isActive || isEmpty) return
                  e.currentTarget.style.borderColor = 'rgba(82,254,254,0.4)'
                  e.currentTarget.style.background = 'rgba(82,254,254,0.04)'
                }}
                onMouseLeave={(e) => {
                  if (isActive || isEmpty) return
                  e.currentTarget.style.borderColor = 'var(--chrome-border)'
                  e.currentTarget.style.background = 'transparent'
                }}
                onMouseDown={(e) => { if (!isEmpty) e.currentTarget.style.transform = 'translateY(1px)' }}
                onMouseUp={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
              >
                {f.label}
                <span style={{ fontFamily: 'var(--font-code)', fontFeatureSettings: '"tnum" 1', fontSize: '0.7rem', opacity: 0.7 }}>
                  {count}
                </span>
              </button>
            )
          })}
          <div style={{ marginLeft: 'auto' }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.75rem',
                color: 'var(--chrome-text)',
                background: 'var(--chrome-surface)',
                border: '1px solid var(--chrome-border)',
                borderRadius: 4,
                padding: '4px 8px',
              }}
            >
              <option value="chapter">By Chapter</option>
              <option value="date">By Date</option>
            </select>
          </div>
        </div>

        {/* Count */}
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: 'var(--chrome-text)', marginBottom: 16 }}>
          {allBookAnnotations.length} annotation{allBookAnnotations.length !== 1 ? 's' : ''}
        </div>

        {/* Annotations list */}
        {allBookAnnotations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--chrome-text)', opacity: 0.6 }}>
              No annotations yet. Highlight text, add bookmarks, or leave notes while reading.
            </div>
          </div>
        ) : grouped ? (
          // Grouped by chapter
          Array.from(grouped.entries()).map(([chId, items]) => (
            <div key={chId} style={{ marginBottom: 24 }}>
              <div style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--chrome-text)',
                marginBottom: 8,
                paddingBottom: 4,
                borderBottom: '1px solid var(--chrome-border)',
              }}>
                {formatChapterId(chId)}
              </div>
              {items.map(renderAnnotation)}
            </div>
          ))
        ) : (
          // Flat list (sorted by date)
          sorted.map(renderAnnotation)
        )}
      </div>
    </div>
  )
}
