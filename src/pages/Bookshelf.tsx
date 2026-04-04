import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useBooks } from '@/hooks/useBooks'
import { useKeyboard } from '@/hooks/useKeyboard'
import RoughBox from '@/components/shared/RoughBox'
import type { BookSummary } from '@/types/book'

/* ─── Last-Read Data ──────────────────────────────────────────────── */

interface LastRead {
  bookId: string
  chapterId: string
  scrollPercent: number
  timestamp: string
}

function getLastRead(): LastRead | null {
  try {
    const raw = localStorage.getItem('codex-last-read')
    if (!raw) return null
    const data = JSON.parse(raw) as LastRead
    // Expire after 30 days
    const age = Date.now() - new Date(data.timestamp).getTime()
    if (age > 30 * 24 * 60 * 60 * 1000) return null
    return data
  } catch {
    return null
  }
}

/* ─── Continue Reading Card ───────────────────────────────────────── */

function ContinueReadingCard({
  lastRead,
  books,
}: {
  lastRead: LastRead
  books: BookSummary[]
}) {
  const book = books.find((b) => b.id === lastRead.bookId)
  if (!book) return null

  const percent = Math.round(lastRead.scrollPercent * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{ marginBottom: '2rem' }}
    >
      <Link
        to={`/book/${lastRead.bookId}/${lastRead.chapterId}`}
        style={{ textDecoration: 'none', display: 'block' }}
      >
        <div
          style={{
            background: 'var(--chrome-surface)',
            border: '1px solid rgba(82, 254, 254, 0.15)',
            borderRadius: 12,
            padding: '1.25rem 1.5rem',
            backdropFilter: 'blur(12px)',
            transition:
              'border-color 200ms ease, box-shadow 200ms ease, transform 200ms ease',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget
            el.style.borderColor = 'rgba(82, 254, 254, 0.35)'
            el.style.boxShadow = '0 0 24px rgba(82, 254, 254, 0.06)'
            el.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget
            el.style.borderColor = 'rgba(82, 254, 254, 0.15)'
            el.style.boxShadow = 'none'
            el.style.transform = 'translateY(0)'
          }}
        >
          {/* Label */}
          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.7rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--chrome-accent)',
              margin: '0 0 0.6rem 0',
            }}
          >
            Continue Reading
          </p>

          {/* Book + Chapter */}
          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '1.05rem',
              fontWeight: 600,
              color: '#f1f5f9',
              margin: '0 0 0.15rem 0',
            }}
          >
            {book.title}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.8rem',
              color: 'var(--chrome-text)',
              margin: '0 0 0.75rem 0',
            }}
          >
            Chapter: {lastRead.chapterId}
          </p>

          {/* Progress bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: 'var(--chrome-border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${percent}%`,
                  background: 'var(--chrome-accent)',
                  borderRadius: 2,
                  transition: 'width 300ms ease',
                }}
              />
            </div>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.7rem',
                color: 'var(--chrome-text)',
                letterSpacing: '0.02em',
                flexShrink: 0,
              }}
            >
              {percent}%
            </span>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.8rem',
                color: 'var(--chrome-accent)',
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              Resume →
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

/* ─── Book Cover Gradient ─────────────────────────────────────────── */

function BookCover({
  title,
  coverColor,
}: {
  title: string
  coverColor: string
}) {
  // Build a two-stop gradient from the cover color → a darker shade
  const darkened = `color-mix(in srgb, ${coverColor} 40%, #000)`

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '3 / 4',
        background: `linear-gradient(135deg, ${coverColor} 0%, ${darkened} 100%)`,
        borderRadius: '6px 6px 0 0',
        display: 'flex',
        alignItems: 'flex-end',
        padding: '1rem 1.25rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle noise overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.08) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      <h3
        style={{
          fontFamily: "'Caveat', cursive",
          fontSize: '1.6rem',
          fontWeight: 700,
          color: '#fff',
          margin: 0,
          lineHeight: 1.2,
          position: 'relative',
          zIndex: 1,
          textShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        {title}
      </h3>
    </div>
  )
}

/* ─── Book Card ───────────────────────────────────────────────────── */

function BookCard({
  book,
  index,
}: {
  book: BookSummary
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: index * 0.08,
        ease: 'easeOut',
      }}
    >
      <Link
        to={`/book/${book.id}`}
        style={{ textDecoration: 'none', display: 'block' }}
      >
        <RoughBox
          stroke="var(--chrome-border)"
          strokeWidth={1.2}
          roughness={1.5}
          seed={hashSeed(book.id)}
          padding="0"
        >
          <div
            style={{
              background: 'var(--chrome-surface)',
              borderRadius: 6,
              overflow: 'hidden',
              transition:
                'transform 200ms ease, box-shadow 200ms ease',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.transform = 'scale(1.02)'
              el.style.boxShadow =
                '0 0 24px rgba(82, 254, 254, 0.08)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.transform = 'scale(1)'
              el.style.boxShadow = 'none'
            }}
          >
            {/* Generated cover */}
            <BookCover
              title={book.title}
              coverColor={book.coverColor}
            />

            {/* Info section */}
            <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
              {/* Subtitle */}
              {book.subtitle && (
                <p
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.82rem',
                    color: 'var(--chrome-text)',
                    margin: '0 0 0.5rem 0',
                  }}
                >
                  {book.subtitle}
                </p>
              )}

              {/* Description — clamped to 3 lines */}
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.82rem',
                  lineHeight: 1.6,
                  color: 'var(--chrome-text)',
                  opacity: 0.75,
                  margin: '0 0 0.75rem 0',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {book.description}
              </p>

              {/* Tags */}
              {book.tags.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 6,
                    marginBottom: '0.6rem',
                  }}
                >
                  {book.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '0.65rem',
                        letterSpacing: '0.04em',
                        padding: '2px 8px',
                        borderRadius: 999,
                        border: '1px solid var(--chrome-border)',
                        color: 'var(--chrome-text)',
                        background: 'transparent',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Chapter count */}
              <p
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.72rem',
                  color: 'var(--chrome-border)',
                  margin: 0,
                  letterSpacing: '0.02em',
                }}
              >
                {book.chapterCount}{' '}
                {book.chapterCount === 1 ? 'chapter' : 'chapters'}
              </p>
            </div>
          </div>
        </RoughBox>
      </Link>
    </motion.div>
  )
}

/* ─── Spinner ─────────────────────────────────────────────────────── */

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
    </div>
  )
}

/* ─── Empty State ─────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'var(--chrome-bg)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-handwritten)',
          fontSize: '1.4rem',
          color: 'var(--chrome-text)',
          textAlign: 'center',
          maxWidth: 420,
          lineHeight: 1.5,
        }}
      >
        The shelves are empty... Start a conversation with Claude to
        create your first book.
      </p>
    </div>
  )
}

/* ─── Utility ─────────────────────────────────────────────────────── */

/** Deterministic seed from a string — keeps RoughBox strokes stable */
function hashSeed(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/* ─── Bookshelf ───────────────────────────────────────────────────── */

export default function Bookshelf() {
  const { books, loading, error } = useBooks()
  const navigate = useNavigate()
  const lastRead = useMemo(getLastRead, [])

  // Global keyboard shortcuts for the bookshelf
  useKeyboard(
    useMemo(
      () => ({
        // Open first book with Enter
        Enter: () => {
          if (books.length > 0) navigate(`/book/${books[0].id}`)
        },
        // Resume reading with 'r'
        r: () => {
          if (lastRead)
            navigate(
              `/book/${lastRead.bookId}/${lastRead.chapterId}`
            )
        },
      }),
      [books, lastRead, navigate]
    )
  )

  if (loading) return <Spinner />

  if (error) {
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
        <p style={{ color: '#f87171' }}>{error}</p>
      </div>
    )
  }

  if (books.length === 0) return <EmptyState />

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--chrome-bg)',
        padding: '3rem 1.5rem',
      }}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        {/* Header */}
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            fontFamily: "'Rajdhani', var(--font-ui)",
            fontSize: '2.4rem',
            fontWeight: 700,
            color: 'var(--chrome-accent)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            margin: '0 0 0.25rem 0',
          }}
        >
          THE CODEX
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.95rem',
            color: 'var(--chrome-text)',
            margin: '0 0 2.5rem 0',
            letterSpacing: '0.04em',
          }}
        >
          Your technical library
        </motion.p>

        {/* Continue Reading */}
        {lastRead && (
          <ContinueReadingCard lastRead={lastRead} books={books} />
        )}

        {/* Book grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.75rem',
          }}
        >
          {books.map((book, i) => (
            <BookCard key={book.id} book={book} index={i} />
          ))}
        </div>
      </div>

      {/* Keyframe for spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
