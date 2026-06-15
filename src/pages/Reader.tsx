import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useBook } from '@/hooks/useBook'
import { useChapter } from '@/hooks/useChapter'
import { useActiveHeading } from '@/hooks/useActiveHeading'
import { useConcepts } from '@/hooks/useConcepts'
import { useAnnotations } from '@/hooks/useAnnotations'
import { useFocusMode } from '@/hooks/useFocusMode'
import { useWS, useWSStatus } from '@/providers/WebSocketProvider'
import BlockRenderer from '@/components/blocks/BlockRenderer'
import DraftActionBar from '@/components/blocks/DraftActionBar'
import TableOfContents from '@/components/layout/TableOfContents'
import ChapterNav from '@/components/layout/ChapterNav'
import ReadingProgress from '@/components/layout/ReadingProgress'
import ConceptTooltip from '@/components/knowledge/ConceptTooltip'
import GlossaryPanel from '@/components/knowledge/GlossaryPanel'
import PreferencesPanel from '@/components/preferences/PreferencesPanel'
import AnnotationToolbar from '@/components/annotations/AnnotationToolbar'
import MarginNoteLayer from '@/components/annotations/MarginNoteLayer'
import ConfusionIndicator from '@/components/annotations/ConfusionIndicator'
import BookmarkIndicator from '@/components/annotations/BookmarkIndicator'
import { useHighlightRenderer } from '@/components/annotations/HighlightRenderer'
import HighlightActionToolbar from '@/components/annotations/HighlightActionToolbar'
import ExportMenu from '@/components/export/ExportMenu'
import VersionTimeline from '@/components/history/VersionTimeline'
import type { Commit, DraftReview } from '@/components/history/VersionTimeline'
import RewrittenChip from '@/components/blocks/RewrittenChip'
import ProvenanceMark from '@/components/blocks/ProvenanceMark'

/* ─── Theme Toggle ─────────────────────────────────────────────────── */
type Theme = 'light' | 'dark' | 'sepia'

const THEMES: { key: Theme; color: string; label: string }[] = [
  { key: 'light', color: '#faf8f3', label: 'Light' },
  { key: 'dark', color: '#1a1a2e', label: 'Dark' },
  { key: 'sepia', color: '#f4ecd8', label: 'Sepia' },
]

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('atheneum-theme')
  if (stored === 'light' || stored === 'dark' || stored === 'sepia') return stored
  return 'light'
}

function ThemeToggle() {
  const [active, setActive] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', active)
    localStorage.setItem('atheneum-theme', active)
  }, [active])

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {THEMES.map((t) => (
        <button
          type="button"
          key={t.key}
          onClick={() => setActive(t.key)}
          title={t.label}
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: t.color,
            border: active === t.key ? '2px solid var(--chrome-accent)' : '2px solid var(--chrome-border)',
            cursor: 'pointer',
            padding: 0,
            transition: 'border-color 200ms ease',
          }}
        />
      ))}
    </div>
  )
}

/* ─── Skeleton Loading State ───────────────────────────────────────── */
import { SkeletonChapterList, SkeletonChapterContent, ShimmerStyle } from '@/components/shared/Skeleton'
import ErrorState from '@/components/shared/ErrorState'
import ShortcutOverlay from '@/components/shared/ShortcutOverlay'

/* ─── Mobile Detection Hook ───────────────────────────────────────── */
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

/* ─── Reader ───────────────────────────────────────────────────────── */
export default function Reader() {
  const { bookId, chapterId } = useParams()
  const navigate = useNavigate()
  useWS() // ensure WS connection is active
  const wsStatus = useWSStatus()
  const { book, loading: bookLoading, error: bookError } = useBook(bookId)
  const { conceptIndex } = useConcepts(bookId)
  const activeHeadingId = useActiveHeading()
  const contentAreaRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768)
  const [glossaryOpen, setGlossaryOpen] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyData, setHistoryData] = useState<Commit[]>([])
  // Forge: which block's AI rewrite is currently open in the review diff (or null).
  const [draftReview, setDraftReview] = useState<DraftReview | null>(null)
  const [shortcutOverlayOpen, setShortcutOverlayOpen] = useState(false)
  const [readChapters, setReadChapters] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(`atheneum-progress-${bookId}`) || '{}') }
    catch { return {} }
  })

  // Focus mode
  const { focusModeActive, focusedBlockId, toggleFocusMode } = useFocusMode(contentAreaRef)

  // Redirect to first chapter if none specified
  useEffect(() => {
    if (book && !chapterId && book.chapters.length > 0) {
      navigate(`/book/${book.id}/${book.chapters[0].id}`, { replace: true })
    }
  }, [book, chapterId, navigate])

  // Resolve the active chapter ID (from URL or first chapter)
  const activeChapterId = chapterId ?? book?.chapters[0]?.id
  const { chapter, loading: chapterLoading, error: chapterError } = useChapter(bookId, activeChapterId)

  // Fetch history when panel opens
  const openHistory = useCallback(() => {
    if (!bookId || !activeChapterId) return
    setHistoryOpen(true)
    fetch(`/api/books/${bookId}/chapters/${activeChapterId}/history`)
      .then((res) => (res.ok ? res.json() : Promise.reject('failed')))
      .then((data: { commits: Commit[] }) => setHistoryData(data.commits))
      .catch(() => setHistoryData([]))
  }, [bookId, activeChapterId])

  // Annotations (persisted to localStorage)
  const {
    highlights, bookmarks, marginNotes, confusionMarkers,
    addAnnotation, addAnnotationSynced, removeAnnotation, updateAnnotation,
  } = useAnnotations(bookId, activeChapterId)

  // Forge: map a published block id → its pending AI draft replacement. A draft
  // block "replaces" a published block when it has status:'draft' and its
  // metadata.insertedAfter points at that published block (the linkage set by the
  // surgical improve_chapter → insert_blocks afterBlockId flow).
  const draftReplacements = useMemo(() => {
    const map = new Map<string, NonNullable<typeof chapter>['blocks'][number]>()
    if (!chapter) return map
    const publishedIds = new Set(
      chapter.blocks.filter((b) => b.status !== 'draft').map((b) => b.id)
    )
    for (const block of chapter.blocks) {
      const after = block.metadata?.insertedAfter
      if (block.status === 'draft' && after && publishedIds.has(after) && !map.has(after)) {
        map.set(after, block)
      }
    }
    return map
  }, [chapter])

  // A draft that REPLACES a published block is reviewed via the chip + diff, so it
  // must NOT also render inline (that would double-show the rewrite). Other drafts
  // (brand-new, not replacements) still render inline with their draft action bar.
  const replacementDraftIds = useMemo(
    () => new Set([...draftReplacements.values()].map((b) => b.id)),
    [draftReplacements]
  )

  // Synthesize the before/after chapter pair and open the review diff for one block.
  const openDraftReview = useCallback(
    (originalBlockId: string) => {
      if (!chapter) return
      const draftBlock = draftReplacements.get(originalBlockId)
      const originalBlock = chapter.blocks.find((b) => b.id === originalBlockId)
      if (!draftBlock || !originalBlock) return

      // Focused single-block review: DiffViewer should show ONLY this block —
      // original vs the AI draft — not the whole chapter. Keep/Revert act by block
      // id (see handleKeep/handleDraftRevert), so these synthesized one-block
      // chapters are purely what the diff renders, nothing more.
      const before = { ...chapter, blocks: [originalBlock] }
      const after = {
        ...chapter,
        // Same id as the original so DiffViewer reads a clean MODIFICATION, not add+delete.
        blocks: [{ ...draftBlock, id: originalBlockId, status: 'published' }],
      }

      setDraftReview({
        draftBlockId: draftBlock.id,
        originalBlockId,
        before,
        after,
      })
    },
    [chapter, draftReplacements]
  )

  // Highlight action toolbar state (shown when clicking an existing highlight)
  const [highlightAction, setHighlightAction] = useState<{
    id: string; color: string; x: number; y: number
  } | null>(null)

  const handleHighlightClick = useCallback((id: string) => {
    // Find the <mark> element and position toolbar above it, relative to container
    const mark = document.querySelector(`mark[data-highlight-id="${id}"]`)
    if (!mark) return
    const container = contentAreaRef.current
    if (!container) return
    const rect = mark.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const hl = highlights.find(h => h.id === id)
    setHighlightAction({
      id,
      color: hl?.color ?? 'yellow',
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8,
    })
  }, [highlights])

  useHighlightRenderer(highlights, handleHighlightClick)

  // Find current chapter index for prev/next navigation
  const currentIndex = book?.chapters.findIndex((c) => c.id === activeChapterId) ?? -1
  const prevChapter = currentIndex > 0 ? book?.chapters[currentIndex - 1] : null
  const nextChapter = book && currentIndex < book.chapters.length - 1 ? book.chapters[currentIndex + 1] : null

  // Chapter-level progress (how far through the book)
  const progress =
    book && book.chapters.length > 0
      ? Math.round(((currentIndex + 1) / book.chapters.length) * 100)
      : 0

  // Cycle through themes
  const cycleTheme = useCallback(() => {
    const current = (localStorage.getItem('atheneum-theme') || 'light') as Theme
    const order: Theme[] = ['light', 'dark', 'sepia']
    const next = order[(order.indexOf(current) + 1) % order.length]
    localStorage.setItem('atheneum-theme', next)
    document.documentElement.setAttribute('data-theme', next)
    // Force ThemeToggle to re-render via storage event workaround
    window.dispatchEvent(new Event('storage'))
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ignore if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (e.key) {
        case 'ArrowLeft':
          if (prevChapter && book) {
            navigate(`/book/${book.id}/${prevChapter.id}`)
          }
          break
        case 'ArrowRight':
          if (nextChapter && book) {
            navigate(`/book/${book.id}/${nextChapter.id}`)
          }
          break
        case 't':
          cycleTheme()
          break
        case 's':
          setSidebarOpen((v) => !v)
          break
        case 'g':
          if (conceptIndex) setGlossaryOpen((v) => !v)
          break
        case 'f':
          toggleFocusMode()
          break
        case 'p':
          setPreferencesOpen((v) => !v)
          break
        case 'h':
          if (!historyOpen) openHistory()
          else setHistoryOpen(false)
          break
        case '?':
          setShortcutOverlayOpen(v => !v)
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [prevChapter, nextChapter, book, navigate, cycleTheme, conceptIndex, historyOpen, openHistory])

  // --- Swipe gestures for chapter navigation (mobile) ---
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!isMobile) return

    function onTouchStart(e: TouchEvent) {
      const t = e.touches[0]
      touchStartRef.current = { x: t.clientX, y: t.clientY }
    }

    function onTouchEnd(e: TouchEvent) {
      if (!touchStartRef.current) return
      const t = e.changedTouches[0]
      const dx = t.clientX - touchStartRef.current.x
      const dy = t.clientY - touchStartRef.current.y
      touchStartRef.current = null

      // Must be a horizontal swipe: >80px horizontal, <50px vertical drift
      if (Math.abs(dx) < 80 || Math.abs(dy) > 50) return

      if (dx < 0 && nextChapter && book) {
        // Swipe left → next chapter
        navigate(`/book/${book.id}/${nextChapter.id}`)
      } else if (dx > 0 && prevChapter && book) {
        // Swipe right → previous chapter
        navigate(`/book/${book.id}/${prevChapter.id}`)
      }
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [isMobile, prevChapter, nextChapter, book, navigate])

  // --- Scroll position: save (debounced 2s) + server sync ---
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasRestoredRef = useRef(false)

  useEffect(() => {
    if (!bookId || !activeChapterId) return

    function onScroll() {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = setTimeout(() => {
        const maxScroll = document.body.scrollHeight - window.innerHeight
        if (maxScroll <= 0) return
        const scrollPercent = window.scrollY / maxScroll
        const position = {
          bookId,
          chapterId: activeChapterId,
          scrollPercent,
          timestamp: new Date().toISOString(),
        }
        localStorage.setItem('atheneum-last-read', JSON.stringify(position))

        // Track chapter visits for reading progress
        // A chapter is "read" when user scrolls past 80%
        if (scrollPercent > 0.8 && activeChapterId) {
          try {
            const key = `atheneum-progress-${bookId}`
            const existing = JSON.parse(localStorage.getItem(key) || '{}')
            if (!existing[activeChapterId]) {
              existing[activeChapterId] = new Date().toISOString()
              localStorage.setItem(key, JSON.stringify(existing))
              setReadChapters(prev => ({ ...prev, [activeChapterId]: existing[activeChapterId] }))
            }
          } catch { /* ignore */ }
        }

        // Background sync to server (fire-and-forget)
        fetch('/api/reading-position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(position),
        }).catch(() => {})
      }, 2000)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    }
  }, [bookId, activeChapterId])

  // --- Scroll position: restore on chapter load (localStorage + server) ---
  useEffect(() => {
    if (chapterLoading || !chapter || !bookId || !activeChapterId) return
    if (hasRestoredRef.current) return
    hasRestoredRef.current = true

    // Helper to apply a scroll position
    function applyScroll(scrollPercent: number) {
      requestAnimationFrame(() => {
        const maxScroll = document.body.scrollHeight - window.innerHeight
        if (maxScroll > 0) {
          window.scrollTo({ top: maxScroll * scrollPercent, behavior: 'instant' })
        }
      })
    }

    // 1) Immediately restore from localStorage (instant)
    let localSaved: { bookId: string; chapterId: string; scrollPercent: number; timestamp: string } | null = null
    try {
      const raw = localStorage.getItem('atheneum-last-read')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.bookId === bookId && parsed.chapterId === activeChapterId && parsed.scrollPercent > 0) {
          localSaved = parsed
          applyScroll(parsed.scrollPercent)
        }
      }
    } catch {
      // ignore
    }

    // 2) Also check server — use server position if more recent
    fetch(`/api/reading-position/${bookId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((serverPos: { bookId: string; chapterId: string; scrollPercent: number; timestamp: string }) => {
        if (!serverPos || serverPos.bookId !== bookId || serverPos.chapterId !== activeChapterId) return
        if (serverPos.scrollPercent <= 0) return

        // Use server position if it's more recent than local
        const serverTime = new Date(serverPos.timestamp).getTime()
        const localTime = localSaved ? new Date(localSaved.timestamp).getTime() : 0

        if (serverTime > localTime) {
          // Server is newer — update localStorage and scroll
          localStorage.setItem('atheneum-last-read', JSON.stringify(serverPos))
          applyScroll(serverPos.scrollPercent)
        }
      })
      .catch(() => {
        // Server unavailable — localStorage already applied
      })
  }, [chapterLoading, chapter, bookId, activeChapterId])

  // Reset restore flag when chapter changes
  useEffect(() => {
    hasRestoredRef.current = false
  }, [activeChapterId])

  // --- Scroll to block from URL hash (search results, glossary links) ---
  useEffect(() => {
    if (chapterLoading || !chapter) return
    const hash = window.location.hash.slice(1) // remove #
    if (!hash) return
    // Wait for DOM to render, then scroll + highlight
    const timer = setTimeout(() => {
      const el = document.getElementById(hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.style.outline = '2px solid var(--chrome-accent, #52FEFE)'
        el.style.outlineOffset = '4px'
        el.style.borderRadius = '4px'
        el.style.transition = 'outline-color 2s ease'
        setTimeout(() => { el.style.outlineColor = 'transparent' }, 2000)
        // Clear hash so it doesn't re-trigger
        window.history.replaceState(null, '', window.location.pathname)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [chapterLoading, chapter])

  // --- Set document title for PDF filename ---
  useEffect(() => {
    if (book?.title && chapter?.title) {
      document.title = `Atheneum — ${book.title}`
    }
    return () => { document.title = 'Atheneum' }
  }, [book?.title, chapter?.title])

  // --- Loading ---
  if (bookLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--chrome-bg)' }}>
      <ShimmerStyle />
      <div style={{ width: 260, borderRight: '1px solid var(--chrome-border)', padding: '1rem 0' }}>
        <SkeletonChapterList count={10} />
      </div>
      <SkeletonChapterContent />
    </div>
  )

  // --- Error ---
  if (bookError || chapterError) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--chrome-bg)' }}>
        <ErrorState
          message={bookError ?? chapterError ?? 'Something went wrong loading this book.'}
          icon="error"
          onRetry={() => window.location.reload()}
        />
      </div>
    )
  }

  // --- No chapters ---
  if (book && book.chapters.length === 0) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '1rem',
          background: 'var(--chrome-bg)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <p style={{ color: 'var(--chrome-text)', fontSize: '1.1rem' }}>
          This book has no chapters yet.
        </p>
        <p style={{ color: 'var(--chrome-text)', fontSize: '0.85rem', opacity: 0.6 }}>
          Use the Atheneum MCP tools to add content.
        </p>
      </div>
    )
  }

  // --- No book ---
  if (!book) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--chrome-bg)',
        }}
      >
        <p style={{ fontFamily: 'var(--font-handwritten)', color: 'var(--chrome-text)', fontSize: '1.2rem' }}>
          Book not found.
        </p>
      </div>
    )
  }

  const sidebarWidth = sidebarOpen ? 260 : 0

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ─── Skip to content (keyboard accessibility) ─── */}
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          left: -9999,
          top: 0,
          zIndex: 9999,
          padding: '8px 16px',
          background: 'var(--chrome-accent)',
          color: '#0a0e17',
          fontFamily: 'var(--font-ui)',
          fontWeight: 600,
          fontSize: '0.85rem',
          borderRadius: '0 0 6px 0',
          textDecoration: 'none',
        }}
        onFocus={(e) => { e.currentTarget.style.left = '0' }}
        onBlur={(e) => { e.currentTarget.style.left = '-9999px' }}
      >
        Skip to content
      </a>

      {/* ─── Reading progress bar ─── */}
      <ReadingProgress />

      {/* ─── Mobile backdrop ─── */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 49,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* ─── Sidebar (JARVIS chrome zone) ─── */}
      <aside
        className="reader-sidebar"
        role="navigation"
        aria-label="Table of contents"
        style={{
          width: isMobile ? 280 : sidebarWidth,
          flexShrink: 0,
          position: isMobile ? 'fixed' : 'sticky',
          top: 0,
          left: isMobile ? (sidebarOpen ? 0 : -280) : undefined,
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          background: 'linear-gradient(180deg, var(--chrome-bg) 0%, var(--chrome-surface) 100%)',
          borderRight: (isMobile || sidebarOpen) ? '1px solid var(--chrome-border)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          padding: (isMobile || sidebarOpen) ? '1.5rem' : 0,
          transition: isMobile
            ? 'left 250ms ease'
            : 'width 250ms ease, padding 250ms ease',
          zIndex: isMobile ? 50 : undefined,
        }}
      >
        {(sidebarOpen || isMobile) && (
          <>
            {/* Back link */}
            <Link
              to="/"
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.8rem',
                color: 'var(--chrome-text)',
                textDecoration: 'none',
                marginBottom: '1.5rem',
                display: 'block',
                transition: 'color 200ms ease',
                letterSpacing: '0.02em',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--chrome-hover-text, #f1f5f9)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--chrome-text)' }}
            >
              &larr; Back to library
            </Link>

            {/* Book title */}
            <h2
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '1.05rem',
                fontWeight: 600,
                color: '#f1f5f9',
                margin: '0 0 0.2rem 0',
                letterSpacing: '0.01em',
              }}
            >
              {book.title}
            </h2>
            {book.subtitle && (
              <p
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.78rem',
                  color: 'var(--chrome-text)',
                  margin: '0 0 1.5rem 0',
                }}
              >
                {book.subtitle}
              </p>
            )}

            {/* Chapter list */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {book.chapters.map((ch) => {
                const isActive = ch.id === activeChapterId
                return (
                  <Link
                    key={ch.id}
                    to={`/book/${book.id}/${ch.id}`}
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.85rem',
                      textDecoration: 'none',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 4,
                      borderLeft: isActive ? '3px solid var(--chrome-accent)' : '3px solid transparent',
                      color: isActive ? 'var(--chrome-accent)' : 'var(--chrome-text)',
                      background: isActive ? 'rgba(82, 254, 254, 0.06)' : 'transparent',
                      fontWeight: isActive ? 600 : 400,
                      transition: 'color 200ms ease, background 200ms ease, border-color 200ms ease',
                      display: 'flex',
                      gap: 8,
                      alignItems: 'baseline',
                      letterSpacing: '0.01em',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.color = 'var(--chrome-hover-text, #f1f5f9)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.color = 'var(--chrome-text)'
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', opacity: 0.5, minWidth: 18 }}>
                      {ch.number}.
                    </span>
                    <span style={{ flex: 1 }}>{ch.title}</span>
                    {readChapters[ch.id] && (
                      <span style={{ color: 'var(--color-success, #16a34a)', fontSize: '0.7rem', opacity: 0.6, flexShrink: 0 }}>{'\u2713'}</span>
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* ─── In-chapter headings TOC ─── */}
            {chapter && chapter.blocks.length > 0 && (
              <div
                style={{
                  marginTop: '1.25rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--chrome-border)',
                }}
              >
                <TableOfContents blocks={chapter.blocks} activeHeadingId={activeHeadingId} />
              </div>
            )}

            {/* ─── Knowledge tools ─── */}
            <div
              style={{
                marginTop: '1.25rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--chrome-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.65rem',
                  color: 'var(--chrome-text)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                Knowledge
              </div>
              <Link
                to={`/book/${book.id}/graph`}
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.82rem',
                  textDecoration: 'none',
                  padding: '0.4rem 0.75rem',
                  borderRadius: 4,
                  color: 'var(--chrome-text)',
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'color 200ms ease, background 200ms ease',
                  letterSpacing: '0.01em',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--chrome-accent)'
                  e.currentTarget.style.background = 'rgba(82, 254, 254, 0.06)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--chrome-text)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="4" cy="6" r="2" />
                  <circle cx="20" cy="6" r="2" />
                  <circle cx="4" cy="18" r="2" />
                  <circle cx="20" cy="18" r="2" />
                  <line x1="6" y1="7" x2="10.5" y2="11" />
                  <line x1="18" y1="7" x2="13.5" y2="11" />
                  <line x1="6" y1="17" x2="10.5" y2="13" />
                  <line x1="18" y1="17" x2="13.5" y2="13" />
                </svg>
                Knowledge Map
              </Link>
              <button
                type="button"
                onClick={() => setGlossaryOpen(true)}
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.82rem',
                  textDecoration: 'none',
                  padding: '0.4rem 0.75rem',
                  borderRadius: 4,
                  color: 'var(--chrome-text)',
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'color 200ms ease, background 200ms ease',
                  letterSpacing: '0.01em',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--chrome-accent)'
                  e.currentTarget.style.background = 'rgba(82, 254, 254, 0.06)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--chrome-text)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  <line x1="8" y1="7" x2="16" y2="7" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
                Glossary
                {conceptIndex && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      opacity: 0.5,
                      marginLeft: 'auto',
                    }}
                  >
                    {conceptIndex.concepts.size}
                  </span>
                )}
              </button>
              <Link
                to={`/book/${book.id}/study`}
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.8rem',
                  color: 'var(--chrome-text)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0.4rem 0.5rem',
                  borderRadius: 4,
                  transition: 'color 200ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--chrome-hover-text, #f1f5f9)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--chrome-text)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                Study
              </Link>
              <Link
                to={`/book/${book.id}/notebook`}
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.8rem',
                  color: 'var(--chrome-text)',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0.4rem 0.5rem',
                  borderRadius: 4,
                  transition: 'color 200ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--chrome-hover-text, #f1f5f9)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--chrome-text)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                Notebook
              </Link>
            </div>

            {/* Bottom: export, theme toggle + progress */}
            <div
              style={{
                marginTop: 'auto',
                paddingTop: '1rem',
                borderTop: '1px solid var(--chrome-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Export menu */}
              {chapter && bookId && activeChapterId && (
                <ExportMenu
                  bookId={bookId}
                  chapterId={activeChapterId}
                  book={book}
                  chapter={chapter}
                />
              )}

              {/* History button */}
              {bookId && activeChapterId && (
                <button
                  type="button"
                  onClick={openHistory}
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.82rem',
                    textDecoration: 'none',
                    padding: '0.4rem 0.75rem',
                    borderRadius: 4,
                    color: 'var(--chrome-text)',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'color 200ms ease, background 200ms ease',
                    letterSpacing: '0.01em',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--chrome-accent)'
                    e.currentTarget.style.background = 'rgba(82, 254, 254, 0.06)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--chrome-text)'
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  History
                </button>
              )}

              <ThemeToggle />
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.7rem',
                    color: 'var(--chrome-text)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    marginBottom: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  Progress
                  <span
                    title={wsStatus === 'connected' ? 'Connected' : wsStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: wsStatus === 'connected' ? '#4ade80' : wsStatus === 'connecting' ? '#f59e0b' : '#f87171',
                      display: 'inline-block',
                      flexShrink: 0,
                      transition: 'background 300ms ease',
                      boxShadow: wsStatus === 'connected'
                        ? '0 0 4px rgba(74, 222, 128, 0.5)'
                        : wsStatus === 'connecting'
                        ? '0 0 4px rgba(245, 158, 11, 0.5)'
                        : '0 0 4px rgba(248, 113, 113, 0.5)',
                    }}
                  />
                </div>
                <div
                  style={{
                    height: 3,
                    borderRadius: 2,
                    background: 'var(--chrome-border)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${progress}%`,
                      background: 'var(--chrome-accent)',
                      borderRadius: 2,
                      transition: 'width 300ms ease',
                    }}
                  />
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.75rem',
                    color: 'var(--chrome-accent)',
                    marginTop: 4,
                    letterSpacing: '0.02em',
                  }}
                >
                  {progress}%
                </div>
              </div>

              {/* Preferences gear button */}
              <button
                type="button"
                onClick={() => setPreferencesOpen(true)}
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.82rem',
                  textDecoration: 'none',
                  padding: '0.4rem 0.75rem',
                  borderRadius: 4,
                  color: 'var(--chrome-text)',
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'color 200ms ease, background 200ms ease',
                  letterSpacing: '0.01em',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--chrome-accent)'
                  e.currentTarget.style.background = 'rgba(82, 254, 254, 0.06)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--chrome-text)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Preferences
              </button>

              {/* Keyboard shortcut hints */}
              <div
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.6rem',
                  color: 'var(--chrome-text)',
                  opacity: 0.4,
                  lineHeight: 1.6,
                }}
              >
                <kbd style={{ opacity: 0.7 }}>&larr;</kbd> / <kbd style={{ opacity: 0.7 }}>&rarr;</kbd> chapters
                &nbsp;&middot;&nbsp;
                <kbd style={{ opacity: 0.7 }}>t</kbd> theme
                &nbsp;&middot;&nbsp;
                <kbd style={{ opacity: 0.7 }}>s</kbd> sidebar
                &nbsp;&middot;&nbsp;
                <kbd style={{ opacity: 0.7 }}>g</kbd> glossary
                &nbsp;&middot;&nbsp;
                <kbd style={{ opacity: 0.7 }}>h</kbd> history
                &nbsp;&middot;&nbsp;
                <kbd style={{ opacity: 0.7 }}>p</kbd> prefs
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ─── Sidebar toggle (always visible) ─── */}
      <button
        type="button"
        onClick={() => setSidebarOpen((v) => !v)}
        title={sidebarOpen ? 'Hide sidebar (s)' : 'Show sidebar (s)'}
        aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        data-print-hide
        style={{
          position: 'fixed',
          top: 10,
          left: isMobile
            ? (sidebarOpen ? 264 : 10)
            : (sidebarOpen ? 248 : 10),
          zIndex: 60,
          width: isMobile ? 36 : 28,
          height: isMobile ? 36 : 28,
          background: 'var(--chrome-bg)',
          border: '1px solid var(--chrome-border)',
          borderRadius: 6,
          color: 'var(--chrome-text)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: isMobile ? '16px' : '12px',
          fontFamily: 'var(--font-ui)',
          transition: 'left 250ms ease, opacity 200ms ease',
          opacity: 0.7,
          padding: 0,
          /* Ensure 44px touch target even if visual is smaller */
          minWidth: 44,
          minHeight: 44,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6' }}
      >
        {sidebarOpen ? '\u2039' : '\u203A'}
      </button>

      {/* ─── Main content (notebook zone) ─── */}
      <main
        id="main-content"
        className="page-container"
        role="main"
        aria-label="Chapter content"
        style={{
          flex: 1,
          minWidth: 0,
          /* Override page-container defaults that conflict with flex layout */
          margin: 0,
          maxWidth: 'none',
        }}
      >
        {chapterLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5rem 0' }}>
            <div
              style={{
                width: 24,
                height: 24,
                border: '2px solid var(--ink-faint)',
                borderTopColor: 'var(--ink-primary)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          </div>
        ) : chapter ? (
          <>
            {/* Chapter header (hidden in print — blocks have the title) */}
            <header className="chapter-header-section" style={{ marginBottom: '2.5rem' }}>
              <p
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.8rem',
                  color: 'var(--ink-faint)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  margin: '0 0 0.4rem 0',
                }}
              >
                Chapter {chapter.number}
              </p>
              <h1
                className="notebook-h1"
                style={{ margin: '0 0 0.3rem 0' }}
              >
                {chapter.title}
              </h1>
              {chapter.subtitle && (
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '1.05rem',
                    color: 'var(--ink-secondary)',
                    margin: '0 0 0.75rem 0',
                  }}
                >
                  {chapter.subtitle}
                </p>
              )}
              {chapter.estimatedReadMinutes > 0 && (
                <p
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.75rem',
                    color: 'var(--ink-faint)',
                    margin: 0,
                    letterSpacing: '0.03em',
                  }}
                >
                  ~{chapter.estimatedReadMinutes} min read
                </p>
              )}
              {/* Provenance: how many blocks the AI authored that no human has vetted. */}
              {(() => {
                const n = chapter.blocks.filter(
                  (b) => b.metadata?.origin === 'ai-manual' || b.metadata?.origin === 'ai-improve-loop'
                ).length
                if (n === 0) return null
                return (
                  <p
                    title="These blocks were written by the AI and have not been verified. The amber marks in the margin show which."
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: '0.5rem',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.72rem',
                      letterSpacing: '0.02em',
                      color: 'var(--color-warning, #f59e0b)',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                    {n} AI-authored {n === 1 ? 'block' : 'blocks'}, unverified
                  </p>
                )
              })()}
            </header>

            {/* Blocks + Annotations */}
            <div
              ref={contentAreaRef}
              data-focus-mode={focusModeActive ? 'true' : undefined}
              style={{ display: 'block', position: 'relative' }}
            >
              <AnimatePresence mode="popLayout">
                {(() => {
                  const firstTextIdx = chapter.blocks.findIndex(b => b.type === 'text')
                  return chapter.blocks.map((block, i) => {
                  // Forge: hide replacement-drafts from inline render — reviewed via chip + diff.
                  if (replacementDraftIds.has(block.id)) return null
                  const blockBookmarks = bookmarks.filter(b => b.blockId === block.id)
                  const blockConfusion = confusionMarkers.filter(c => c.blockId === block.id)
                  return (
                    <motion.div
                      key={block.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.015 }}
                      style={{ position: 'relative' }}
                    >
                      <BlockRenderer
                        block={block}
                        isFirstTextBlock={i === firstTextIdx}
                        bookId={bookId}
                        chapterId={activeChapterId}
                        className={focusModeActive && focusedBlockId === block.id ? 'focus-active' : undefined}
                      />
                      {/* Bookmark ribbon */}
                      {blockBookmarks.map(bm => (
                        <BookmarkIndicator
                          key={bm.id}
                          bookmark={bm}
                          onRemove={() => removeAnnotation(bm.id)}
                        />
                      ))}
                      {/* Confusion marker */}
                      {blockConfusion.map(cm => (
                        <ConfusionIndicator
                          key={cm.id}
                          marker={cm}
                          onRemove={() => removeAnnotation(cm.id)}
                        />
                      ))}
                      {/* Forge: a pending AI rewrite exists for this published block — review chip */}
                      {block.status !== 'draft' && draftReplacements.has(block.id) && (
                        <RewrittenChip onReview={() => openDraftReview(block.id)} />
                      )}
                      {/* Provenance: hairline margin mark for AI-authored / human-approved blocks */}
                      {block.metadata?.origin && <ProvenanceMark origin={block.metadata.origin} />}
                    </motion.div>
                  )
                })})()}
              </AnimatePresence>

              {/* Chapter-end flourish */}
              {chapter.blocks.length > 0 && (
                <div className="chapter-end-flourish" style={{
                  textAlign: 'center',
                  padding: '3rem 0 2rem',
                  color: 'var(--ink-faint)',
                  opacity: 0.5,
                }}>
                  <svg width="120" height="20" viewBox="0 0 120 20" style={{ display: 'block', margin: '0 auto 0.75rem' }}>
                    <path
                      d="M10 10 Q30 2 60 10 Q90 18 110 10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <circle cx="10" cy="10" r="2" fill="currentColor" />
                    <circle cx="60" cy="10" r="2" fill="currentColor" />
                    <circle cx="110" cy="10" r="2" fill="currentColor" />
                  </svg>
                  <p style={{
                    fontFamily: 'var(--font-handwritten)',
                    fontSize: '0.85rem',
                    margin: 0,
                    letterSpacing: '0.05em',
                  }}>
                    — end of Chapter {chapter.number} —
                  </p>
                </div>
              )}

              {/* Floating annotation toolbar (appears on text selection) */}
              {bookId && activeChapterId && (
                <AnnotationToolbar
                  bookId={bookId}
                  chapterId={activeChapterId}
                  addAnnotation={addAnnotation}
                  addAnnotationSynced={addAnnotationSynced}
                  contentRef={contentAreaRef}
                />
              )}

              {/* Highlight action toolbar (appears on clicking existing highlight) */}
              <HighlightActionToolbar
                highlightId={highlightAction?.id ?? null}
                currentColor={highlightAction?.color ?? 'yellow'}
                x={highlightAction?.x ?? 0}
                y={highlightAction?.y ?? 0}
                onChangeColor={(id, color) => updateAnnotation(id, { color } as any)}
                onRemove={removeAnnotation}
                onClose={() => setHighlightAction(null)}
              />

              {/* Margin notes layer */}
              <MarginNoteLayer
                notes={marginNotes}
                onRemove={removeAnnotation}
              />
            </div>

            {/* Draft action bar (floating, for batch approve/dismiss) */}
            {bookId && activeChapterId && chapter.blocks.some(b => b.status === 'draft') && (
              <DraftActionBar
                draftCount={chapter.blocks.filter(b => b.status === 'draft').length}
                bookId={bookId}
                chapterId={activeChapterId}
                draftBlockIds={chapter.blocks.filter(b => b.status === 'draft').map(b => b.id)}
                onApproveAll={() => { /* WebSocket will push updated chapter */ }}
                onDismissAll={() => { /* WebSocket will push updated chapter */ }}
              />
            )}

            {/* Prev / Next chapter navigation */}
            <ChapterNav
              prev={prevChapter ? { id: prevChapter.id, number: prevChapter.number, title: prevChapter.title } : null}
              next={nextChapter ? { id: nextChapter.id, number: nextChapter.number, title: nextChapter.title } : null}
              bookId={book.id}
            />
          </>
        ) : (
          <p
            style={{
              fontFamily: 'var(--font-handwritten)',
              color: 'var(--ink-faint)',
              textAlign: 'center',
              padding: '5rem 0',
              fontSize: '1.2rem',
            }}
          >
            Select a chapter from the sidebar.
          </p>
        )}

        <ShimmerStyle />
      </main>

      {/* ─── Concept hover tooltips (event delegation) ─── */}
      <ConceptTooltip conceptIndex={conceptIndex} />

      {/* ─── Glossary side panel ─── */}
      <AnimatePresence>
        {glossaryOpen && conceptIndex && (
          <GlossaryPanel
            conceptIndex={conceptIndex}
            bookId={book.id}
            onClose={() => setGlossaryOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ─── Preferences side panel ─── */}
      <AnimatePresence>
        {preferencesOpen && (
          <PreferencesPanel
            onClose={() => setPreferencesOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ─── Version history side panel ─── */}
      <AnimatePresence>
        {(historyOpen || draftReview) && bookId && activeChapterId && chapter && (
          <VersionTimeline
            bookId={bookId}
            chapterId={activeChapterId}
            commits={historyData}
            currentChapter={chapter}
            draftReview={draftReview ?? undefined}
            onClose={() => { setHistoryOpen(false); setDraftReview(null) }}
            onReverted={() => {
              // Force reload the chapter by navigating to the same page
              window.location.reload()
            }}
          />
        )}
      </AnimatePresence>

      {/* ─── Keyboard shortcut overlay ─── */}
      <ShortcutOverlay open={shortcutOverlayOpen} onClose={() => setShortcutOverlayOpen(false)} />
    </div>
  )
}
