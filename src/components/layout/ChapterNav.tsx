import { Link } from 'react-router-dom'

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
  if (!prev && !next) return null

  return (
    <nav
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        marginTop: '4rem',
        paddingTop: '2rem',
        borderTop: '1px solid var(--ink-faint)',
        gap: '1.5rem',
      }}
    >
      {prev ? (
        <Link
          to={`/book/${bookId}/${prev.id}`}
          style={{
            flex: 1,
            textDecoration: 'none',
            padding: '1rem 1.25rem',
            borderRadius: 6,
            border: '1px solid var(--ink-faint)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
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
              fontSize: '0.7rem',
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
              fontSize: '1.1rem',
              color: 'var(--ink-secondary)',
            }}
          >
            Chapter {prev.number}: {prev.title}
          </span>
        </Link>
      ) : (
        <span style={{ flex: 1 }} />
      )}
      {next ? (
        <Link
          to={`/book/${bookId}/${next.id}`}
          style={{
            flex: 1,
            textDecoration: 'none',
            padding: '1rem 1.25rem',
            borderRadius: 6,
            border: '1px solid var(--ink-faint)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 4,
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
              fontSize: '0.7rem',
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
              fontSize: '1.1rem',
              color: 'var(--ink-secondary)',
            }}
          >
            Chapter {next.number}: {next.title}
          </span>
        </Link>
      ) : (
        <span style={{ flex: 1 }} />
      )}
    </nav>
  )
}
