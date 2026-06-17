import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Highlighter, Bookmark as BookmarkIcon, StickyNote, HelpCircle, ArrowLeft } from 'lucide-react'
import { useBook } from '@/hooks/useBook'
import { useAnnotations } from '@/hooks/useAnnotations'
import type { Annotation, Highlight, Bookmark, MarginNote, ConfusionMarker } from '@/hooks/useAnnotations'
import { SkeletonBlock, ShimmerStyle } from '@/components/shared/Skeleton'
import ErrorState from '@/components/shared/ErrorState'
import { spring, tween, pressable } from '@/lib/motion'

type FilterType = 'all' | 'highlight' | 'bookmark' | 'margin-note' | 'confusion'
type SortBy = 'chapter' | 'date'

const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'highlight', label: 'Highlights' },
  { key: 'bookmark', label: 'Bookmarks' },
  { key: 'margin-note', label: 'Notes' },
  { key: 'confusion', label: 'Confusion' },
]

// Highlight swatch colors keyed to the on-page highlight palette. These are the
// reader's own choices (yellow/green/blue/pink/purple) and are intentionally NOT
// the single accent — each marker keeps its identity on its left rule. Kept as a
// component-scoped map so we never reach into shared CSS for per-highlight color.
const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: '#d4a72c',
  green: '#3f9142',
  blue: '#2f5c8a',
  pink: '#c2557a',
  purple: '#7c5cc4',
}
const highlightColor = (c: string) => HIGHLIGHT_COLORS[c] || HIGHLIGHT_COLORS.yellow

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
    <div style={{ minHeight: '100vh', background: 'var(--paper-bg)', padding: 'var(--space-6) var(--space-5)' }}>
      <ShimmerStyle />
      <div style={{ maxWidth: 720, margin: '0 auto' }}><SkeletonBlock lines={4} /><SkeletonBlock lines={3} /></div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-bg)' }}>
      <ErrorState message={error} icon="error" onRetry={() => window.location.reload()} />
    </div>
  )

  if (!book) return null

  const formatChapterId = (id: string) => {
    const slug = id.replace(/^\d+-/, '')
    return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  // Quiet Inter footer — chapter (when not already grouped under one) and date.
  const footer = (a: Annotation, withChapter: boolean) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-2)',
      flexWrap: 'wrap',
      marginTop: 'var(--space-2)',
      fontFamily: 'var(--font-ui)',
      fontSize: '0.7rem',
      color: 'var(--ink-faint)',
      lineHeight: 1.4,
    }}>
      {withChapter && (
        <>
          <span style={{ fontWeight: 500 }}>{formatChapterId(a.chapterId)}</span>
          <span aria-hidden style={{ opacity: 0.5 }}>&middot;</span>
        </>
      )}
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {new Date(a.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </span>
    </div>
  )

  const renderAnnotation = (a: Annotation, withChapter: boolean) => {
    const link = `/book/${bookId}/${a.chapterId}#${a.blockId}`
    const isHighlight = a.type === 'highlight'
    const railColor = isHighlight ? highlightColor((a as Highlight).color) : 'var(--accent)'

    let Icon = StickyNote
    let eyebrow = 'Note'
    if (a.type === 'highlight') { Icon = Highlighter; eyebrow = 'Highlight' }
    else if (a.type === 'bookmark') { Icon = BookmarkIcon; eyebrow = 'Bookmark' }
    else if (a.type === 'confusion') { Icon = HelpCircle; eyebrow = 'Confusion' }

    return (
      <motion.div key={a.id} {...pressable}>
        <Link
          to={link}
          style={{
            display: 'block',
            position: 'relative',
            padding: 'var(--space-3) var(--space-4)',
            paddingLeft: 'var(--space-5)',
            borderRadius: 'var(--radius-2)',
            borderTop: 'var(--hairline)',
            borderRight: 'var(--hairline)',
            borderBottom: 'var(--hairline)',
            borderLeft: `3px solid ${railColor}`,
            background: `color-mix(in srgb, ${railColor} 5%, var(--surface-raised))`,
            textDecoration: 'none',
            transition: 'box-shadow 200ms, transform 200ms',
            marginBottom: 'var(--space-2)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-2)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          {/* Eyebrow: lucide icon + type label, in the marker's own hue */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
            <Icon size={14} strokeWidth={2} color={railColor} aria-hidden style={{ flexShrink: 0 }} />
            <span style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.66rem',
              fontWeight: 600,
              color: railColor,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>
              {eyebrow}
            </span>
          </div>

          {/* Highlight — the quoted passage, paper-warm Source Serif */}
          {a.type === 'highlight' && (
            <>
              <blockquote style={{
                margin: 0,
                fontFamily: 'var(--font-body)',
                fontSize: '1rem',
                color: 'var(--ink-primary)',
                lineHeight: 1.6,
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                overflowWrap: 'anywhere',
              }}>
                &ldquo;{(a as Highlight).selectedText}&rdquo;
              </blockquote>
              {(a as Highlight).note && (
                <div style={{
                  marginTop: 'var(--space-2)',
                  fontFamily: 'var(--font-body)',
                  fontStyle: 'italic',
                  fontSize: '0.9rem',
                  color: 'var(--ink-secondary)',
                  lineHeight: 1.55,
                  overflowWrap: 'anywhere',
                }}>
                  {(a as Highlight).note}
                </div>
              )}
            </>
          )}

          {/* Bookmark label */}
          {a.type === 'bookmark' && (a as Bookmark).label && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: 'var(--ink-primary)', lineHeight: 1.55, overflowWrap: 'anywhere' }}>
              {(a as Bookmark).label}
            </div>
          )}

          {/* Margin note */}
          {a.type === 'margin-note' && (
            <div style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: '0.95rem', color: 'var(--ink-primary)', lineHeight: 1.55, overflowWrap: 'anywhere' }}>
              {(a as MarginNote).text}
            </div>
          )}

          {/* Confusion note */}
          {a.type === 'confusion' && (a as ConfusionMarker).note && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: 'var(--ink-primary)', lineHeight: 1.55, overflowWrap: 'anywhere' }}>
              {(a as ConfusionMarker).note}
            </div>
          )}

          {footer(a, withChapter)}
        </Link>
      </motion.div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-bg)', padding: 'var(--space-6) var(--space-4)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 'var(--space-5)', paddingBottom: 'var(--space-4)', borderBottom: 'var(--hairline)' }}>
          <Link
            to={`/book/${bookId}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              minHeight: 44,
              fontFamily: 'var(--font-ui)',
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'var(--ink-faint)',
              textDecoration: 'none',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            <ArrowLeft size={13} strokeWidth={2.2} aria-hidden />
            {book.title}
          </Link>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.3rem', fontWeight: 700, color: 'var(--ink-primary)', margin: 'var(--space-1) 0 0', lineHeight: 1.1, letterSpacing: '-0.01em' }}>
            Notes &amp; Highlights
          </h1>
        </div>

        {/* Filters + Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
          {FILTER_OPTIONS.map(f => {
            const count = typeCounts[f.key]
            const isActive = filter === f.key
            // A non-"all" filter with zero matches leads to an identical empty state — disable it.
            const isEmpty = f.key !== 'all' && count === 0
            return (
              <motion.button
                key={f.key}
                type="button"
                disabled={isEmpty}
                onClick={() => { if (!isEmpty) setFilter(f.key) }}
                whileTap={isEmpty ? undefined : { scale: 0.97 }}
                transition={spring.press}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  minHeight: 44,
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.78rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--accent)' : 'var(--ink-secondary)',
                  background: isActive ? 'color-mix(in srgb, var(--accent) 10%, var(--surface-raised))' : 'var(--surface-raised)',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--hairline-color)'}`,
                  borderRadius: 'var(--radius-1)',
                  padding: '0 var(--space-3)',
                  cursor: isEmpty ? 'not-allowed' : 'pointer',
                  opacity: isEmpty ? 0.4 : 1,
                  transition: 'color 150ms, background 150ms, border-color 150ms',
                }}
                onMouseEnter={(e) => {
                  if (isActive || isEmpty) return
                  e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 40%, var(--hairline-color))'
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 5%, var(--surface-raised))'
                }}
                onMouseLeave={(e) => {
                  if (isActive || isEmpty) return
                  e.currentTarget.style.borderColor = 'var(--hairline-color)'
                  e.currentTarget.style.background = 'var(--surface-raised)'
                }}
              >
                {f.label}
                <span style={{
                  fontFamily: 'var(--font-code)',
                  fontFeatureSettings: '"tnum" 1',
                  fontSize: '0.72rem',
                  color: isActive ? 'var(--accent)' : 'var(--ink-faint)',
                }}>
                  {count}
                </span>
              </motion.button>
            )
          })}
          <div style={{ marginLeft: 'auto' }}>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              aria-label="Sort annotations"
              style={{
                minHeight: 44,
                fontFamily: 'var(--font-ui)',
                fontSize: '0.78rem',
                fontWeight: 500,
                color: 'var(--ink-secondary)',
                background: 'var(--surface-raised)',
                border: '1px solid var(--hairline-color)',
                borderRadius: 'var(--radius-1)',
                padding: '0 var(--space-2)',
              }}
            >
              <option value="chapter">By Chapter</option>
              <option value="date">By Date</option>
            </select>
          </div>
        </div>

        {/* Count */}
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.74rem', color: 'var(--ink-faint)', marginBottom: 'var(--space-4)', letterSpacing: '0.02em' }}>
          {allBookAnnotations.length} annotation{allBookAnnotations.length !== 1 ? 's' : ''}
        </div>

        {/* Annotations list */}
        {allBookAnnotations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
            <Highlighter size={28} strokeWidth={1.5} color="var(--ink-faint)" aria-hidden style={{ marginBottom: 'var(--space-3)' }} />
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--ink-secondary)', lineHeight: 1.5, maxWidth: 380, margin: '0 auto' }}>
              No annotations yet. Highlight text, add bookmarks, or leave notes while reading.
            </div>
          </div>
        ) : grouped ? (
          // Grouped by chapter
          Array.from(grouped.entries()).map(([chId, items]) => (
            <motion.div
              key={chId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={tween.enter}
              style={{ marginBottom: 'var(--space-6)' }}
            >
              <div style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.7rem',
                fontWeight: 600,
                color: 'var(--ink-faint)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 'var(--space-3)',
                paddingBottom: 'var(--space-2)',
                borderBottom: 'var(--hairline)',
              }}>
                {formatChapterId(chId)}
              </div>
              {items.map(a => renderAnnotation(a, false))}
            </motion.div>
          ))
        ) : (
          // Flat list (sorted by date) — chapter shown inline in each footer
          sorted.map(a => renderAnnotation(a, true))
        )}
      </div>
    </div>
  )
}
