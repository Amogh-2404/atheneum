import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

function useIsMobile(breakpoint = 600) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint
  )
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

interface ChapterInfo {
  id: string
  number: number
  title: string
}

interface ChapterNavProps {
  prev?: ChapterInfo | null
  next?: ChapterInfo | null
  bookId: string
}

export default function ChapterNav({ prev, next, bookId }: ChapterNavProps) {
  const isMobile = useIsMobile()

  if (!prev && !next) return null

  return (
    <nav
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        marginTop: isMobile ? '2.5rem' : '4rem',
        paddingTop: isMobile ? '1.5rem' : '2rem',
        borderTop: '1px solid var(--ink-faint)',
        gap: isMobile ? '0.75rem' : '1.5rem',
      }}
    >
      {prev ? (
        <Link
          to={`/book/${bookId}/${prev.id}`}
          style={{
            flex: 1,
            textDecoration: 'none',
            padding: isMobile ? '0.75rem 1rem' : '1rem 1.25rem',
            borderRadius: 6,
            border: '1px solid var(--ink-faint)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            minHeight: 48,
            justifyContent: 'center',
            transition: 'border-color 300ms ease, opacity 300ms ease',
            opacity: 0.55,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1'
            e.currentTarget.style.borderColor = 'var(--chrome-accent)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.55'
            e.currentTarget.style.borderColor = 'var(--ink-faint)'
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: isMobile ? '0.6rem' : '0.7rem',
              color: 'var(--ink-faint)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            &larr; Previous
          </span>
          <span
            style={{
              fontFamily: 'var(--font-handwritten)',
              fontSize: isMobile ? '0.95rem' : '1.1rem',
              color: 'var(--ink-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
              display: 'block',
            }}
          >
            Chapter {prev.number}: {prev.title}
          </span>
        </Link>
      ) : (
        !isMobile ? <span style={{ flex: 1 }} /> : null
      )}
      {next ? (
        <Link
          to={`/book/${bookId}/${next.id}`}
          style={{
            flex: 1,
            textDecoration: 'none',
            padding: isMobile ? '0.75rem 1rem' : '1rem 1.25rem',
            borderRadius: 6,
            border: '1px solid var(--ink-faint)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: isMobile ? 'flex-start' : 'flex-end',
            gap: 4,
            minHeight: 48,
            justifyContent: 'center',
            transition: 'border-color 300ms ease, opacity 300ms ease',
            opacity: 0.55,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1'
            e.currentTarget.style.borderColor = 'var(--chrome-accent)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.55'
            e.currentTarget.style.borderColor = 'var(--ink-faint)'
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: isMobile ? '0.6rem' : '0.7rem',
              color: 'var(--ink-faint)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            Next &rarr;
          </span>
          <span
            style={{
              fontFamily: 'var(--font-handwritten)',
              fontSize: isMobile ? '0.95rem' : '1.1rem',
              color: 'var(--ink-secondary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
              display: 'block',
            }}
          >
            Chapter {next.number}: {next.title}
          </span>
        </Link>
      ) : (
        !isMobile ? <span style={{ flex: 1 }} /> : null
      )}
    </nav>
  )
}
