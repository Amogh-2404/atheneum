import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useBook } from '@/hooks/useBook'
import { useChapter } from '@/hooks/useChapter'
import { useActiveHeading } from '@/hooks/useActiveHeading'
import { useConcepts } from '@/hooks/useConcepts'
import { useAnnotations } from '@/hooks/useAnnotations'
import { useWS } from '@/providers/WebSocketProvider'
import BlockRenderer from '@/components/blocks/BlockRenderer'
import TableOfContents from '@/components/layout/TableOfContents'
import ChapterNav from '@/components/layout/ChapterNav'
import ReadingProgress from '@/components/layout/ReadingProgress'
import ConceptTooltip from '@/components/knowledge/ConceptTooltip'
import GlossaryPanel from '@/components/knowledge/GlossaryPanel'
import AnnotationToolbar from '@/components/annotations/AnnotationToolbar'
import MarginNoteLayer from '@/components/annotations/MarginNoteLayer'
import ConfusionIndicator from '@/components/annotations/ConfusionIndicator'
import BookmarkIndicator from '@/components/annotations/BookmarkIndicator'
import { useHighlightRenderer } from '@/components/annotations/HighlightRenderer'
import HighlightActionToolbar from '@/components/annotations/HighlightActionToolbar'
import ExportMenu from '@/components/export/ExportMenu'

/* ─── Theme Toggle ─────────────────────────────────────────────────── */
type Theme = 'light' | 'dark' | 'sepia'

const THEMES: { key: Theme; color: string; label: string }[] = [
  { key: 'light', color: '#faf8f3', label: 'Light' },
  { key: 'dark', color: '#1a1a2e', label: 'Dark' },
  { key: 'sepia', color: '#f4ecd8', label: 'Sepia' },
]

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('codex-theme')
  if (stored === 'light' || stored === 'dark' || stored === 'sepia') return stored
  return 'light'
}

function ThemeToggle() {
  const [active, setActive] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', active)
    localStorage.setItem('codex-theme', active)
  }, [active])

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {THEMES.map((t) => (
        <button
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

/* ─── Spinner ──────────────────────────────────────────────────────── */
function Spinner() {
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
      <div
        style={{
          width: 32,
          height: 32,
          border: '2px solid var(--chrome-border)',
          borderTopColor: 'var(--chrome-accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

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
  const { connected } = useWS()
  const { book, loading: bookLoading, error: bookError } = useBook(bookId)
  const { conceptIndex } = useConcepts(bookId)
  const activeHeadingId = useActiveHeading()
  const contentAreaRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768)
  const [glossaryOpen, setGlossaryOpen] = useState(false)

  // Redirect to first chapter if none specified
  useEffect(() => {
    if (book && !chapterId && book.chapters.length > 0) {
      navigate(`/book/${book.id}/${book.chapters[0].id}`, { replace: true })
    }
  }, [book, chapterId, navigate])

  // Resolve the active chapter ID (from URL or first chapter)
  const activeChapterId = chapterId ?? book?.chapters[0]?.id
  const { chapter, loading: chapterLoading, error: chapterError } = useChapter(bookId, activeChapterId)

  // Annotations (persisted to localStorage)
  const {
    highlights, bookmarks, marginNotes, confusionMarkers,
    addAnnotation, removeAnnotation, updateAnnotation,
  } = useAnnotations(bookId, activeChapterId)

  // Highlight action toolbar state (shown when clicking an existing highlight)
  const [highlightAction, setHighlightAction] = useState<{
    id: string; color: string; x: number; y: number
  } | null>(null)

  const handleHighlightClick = useCallback((id: string) => {
    // Find the <mark> element and position toolbar above it
    const mark = document.querySelector(`mark[data-highlight-id="${id}"]`)
    if (!mark) return
    const rect = mark.getBoundingClientRect()
    const scrollY = window.scrollY
    const scrollX = window.scrollX
    const hl = highlights.find(h => h.id === id)
    setHighlightAction({
      id,
      color: hl?.color ?? 'yellow',
      x: rect.left + scrollX + rect.width / 2,
      y: rect.top + scrollY - 8,
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
    const current = (localStorage.getItem('codex-theme') || 'light') as Theme
    const order: Theme[] = ['light', 'dark', 'sepia']
    const next = order[(order.indexOf(current) + 1) % order.length]
    localStorage.setItem('codex-theme', next)
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
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [prevChapter, nextChapter, book, navigate, cycleTheme, conceptIndex])

  // --- Scroll position: save (debounced 2s) ---
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
        localStorage.setItem(
          'codex-last-read',
          JSON.stringify({
            bookId,
            chapterId: activeChapterId,
            scrollPercent,
            timestamp: new Date().toISOString(),
          })
        )
      }, 2000)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    }
  }, [bookId, activeChapterId])

  // --- Scroll position: restore on chapter load ---
  useEffect(() => {
    if (chapterLoading || !chapter || !bookId || !activeChapterId) return
    if (hasRestoredRef.current) return

    try {
      const raw = localStorage.getItem('codex-last-read')
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved.bookId === bookId && saved.chapterId === activeChapterId && saved.scrollPercent > 0) {
        // Wait a tick for DOM to render blocks
        requestAnimationFrame(() => {
          const maxScroll = document.body.scrollHeight - window.innerHeight
          if (maxScroll > 0) {
            window.scrollTo({ top: maxScroll * saved.scrollPercent, behavior: 'instant' })
          }
        })
      }
    } catch {
      // ignore
    }
    hasRestoredRef.current = true
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

  // --- Loading ---
  if (bookLoading) return <Spinner />

  // --- Error ---
  if (bookError || chapterError) {
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
        <p style={{ color: '#f87171' }}>{bookError ?? chapterError}</p>
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
              onMouseEnter={(e) => { e.currentTarget.style.color = '#f1f5f9' }}
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
                      if (!isActive) e.currentTarget.style.color = '#f1f5f9'
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.color = 'var(--chrome-text)'
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', opacity: 0.5, minWidth: 18 }}>
                      {ch.number}.
                    </span>
                    {ch.title}
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
                    title={connected ? 'Live' : 'Disconnected'}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: connected ? '#34d399' : '#f87171',
                      display: 'inline-block',
                      flexShrink: 0,
                      transition: 'background 300ms ease',
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
              </div>
            </div>
          </>
        )}
      </aside>

      {/* ─── Sidebar toggle (always visible) ─── */}
      <button
        onClick={() => setSidebarOpen((v) => !v)}
        title={sidebarOpen ? 'Hide sidebar (s)' : 'Show sidebar (s)'}
        style={{
          position: 'fixed',
          top: 12,
          left: isMobile
            ? (sidebarOpen ? 268 : 12)
            : (sidebarOpen ? 248 : 12),
          zIndex: 60,
          width: 24,
          height: 24,
          background: 'var(--chrome-bg)',
          border: '1px solid var(--chrome-border)',
          borderRadius: 4,
          color: 'var(--chrome-text)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
          fontFamily: 'var(--font-ui)',
          transition: 'left 250ms ease, opacity 200ms ease',
          opacity: 0.6,
          padding: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6' }}
      >
        {sidebarOpen ? '\u2039' : '\u203A'}
      </button>

      {/* ─── Main content (notebook zone) ─── */}
      <main
        className="page-container"
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
            {/* Chapter header */}
            <header style={{ marginBottom: '2.5rem' }}>
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
            </header>

            {/* Blocks + Annotations */}
            <div ref={contentAreaRef} style={{ display: 'block', position: 'relative' }}>
              <AnimatePresence mode="popLayout">
                {chapter.blocks.map((block, i) => {
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
                      <BlockRenderer block={block} />
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
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {/* Floating annotation toolbar (appears on text selection) */}
              {bookId && activeChapterId && (
                <AnnotationToolbar
                  bookId={bookId}
                  chapterId={activeChapterId}
                  addAnnotation={addAnnotation}
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

        {/* Keyframe for inline spinner */}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
    </div>
  )
}
