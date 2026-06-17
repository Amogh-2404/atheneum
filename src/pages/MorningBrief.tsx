import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Hammer, BookOpen } from 'lucide-react'
import { tween, spring } from '@/lib/motion'

interface Draft {
  chapterId: string
  chapterTitle: string
  chapterNumber: number
  draftId: string
  targetId: string
  signal: string
  before: string
  after: string
}

/**
 * The struggle-signal, phrased as a HEADLINE — second-person, present,
 * the thing the book noticed you do. This leads each card.
 */
function signalHeadline(s: string): string {
  if (s.includes('reread')) return 'You re-read this three times'
  if (s.includes('dwell')) return 'You lingered on this page'
  if (s.includes('confusion')) return 'You flagged this as unclear'
  return 'Something here slowed you down'
}

const semantic = {
  removed: 'var(--callout-warning-border)',
  added: 'var(--callout-example-border)',
}

export default function MorningBrief() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState<Draft[] | null>(null)

  useEffect(() => {
    if (!bookId) return
    fetch(`/api/drafts/${bookId}`)
      .then((r) => r.json())
      .then((d) => setDrafts(d.drafts || []))
      .catch(() => setDrafts([]))
  }, [bookId])

  const eyebrow: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontSize: '0.66rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  }

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: 'var(--chrome-bg)',
        padding: 'var(--space-6) var(--space-5) var(--space-8)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link
          to={bookId ? `/book/${bookId}` : '/'}
          style={{
            ...eyebrow,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 44,
            color: 'var(--ink-faint)',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={13} strokeWidth={2} aria-hidden />
          Back to reading
        </Link>

        {/* Masthead */}
        <header style={{ marginTop: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          <div
            style={{
              ...eyebrow,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--accent)',
              marginBottom: 'var(--space-2)',
            }}
          >
            <Hammer size={13} strokeWidth={2} aria-hidden />
            The Forge
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(2rem, 6vw, 2.6rem)',
              fontWeight: 600,
              color: 'var(--ink-primary)',
              margin: 0,
              lineHeight: 1.08,
              letterSpacing: '-0.01em',
            }}
          >
            Pages the book re-wrote
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1.02rem',
              color: 'var(--ink-secondary)',
              margin: 'var(--space-3) 0 0',
              maxWidth: 540,
              lineHeight: 1.6,
            }}
          >
            Where you struggled, the book quietly drafted a clearer version of itself. Each one is
            unverified and unpublished — nothing changes the book you're reading until you Keep it.
          </p>
        </header>

        {drafts === null && (
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.85rem',
              color: 'var(--ink-faint)',
              padding: 'var(--space-4) 0',
            }}
          >
            Reading your margins…
          </div>
        )}

        {drafts !== null && drafts.length === 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              fontFamily: 'var(--font-body)',
              fontSize: '1rem',
              color: 'var(--ink-secondary)',
              padding: 'var(--space-5)',
              border: 'var(--hairline)',
              borderRadius: 'var(--radius-3)',
              background: 'var(--chrome-surface)',
            }}
          >
            <BookOpen size={18} strokeWidth={1.75} aria-hidden style={{ color: 'var(--ink-faint)', flexShrink: 0 }} />
            Nothing re-forged. The book is reading clean.
          </div>
        )}

        {drafts?.map((d, i) => (
          <motion.article
            key={d.draftId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...tween.enter, delay: Math.min(i * 0.04, 0.2) }}
            style={{
              border: 'var(--hairline)',
              borderRadius: 'var(--radius-3)',
              background: 'var(--chrome-surface)',
              padding: 'var(--space-5)',
              marginBottom: 'var(--space-4)',
            }}
          >
            {/* Eyebrow: chapter (Inter) */}
            <div
              style={{
                ...eyebrow,
                color: 'var(--accent)',
                marginBottom: 'var(--space-2)',
              }}
            >
              Ch.{d.chapterNumber} · {d.chapterTitle}
            </div>

            {/* HEADLINE: the struggle signal (Source Serif) */}
            <h2
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--ink-primary)',
                margin: '0 0 var(--space-4)',
                lineHeight: 1.4,
              }}
            >
              {signalHeadline(d.signal)}
            </h2>

            {/* Inline diff — GitHub-suggestion style, one continuous block */}
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.94rem',
                lineHeight: 1.6,
                border: 'var(--hairline)',
                borderRadius: 'var(--radius-2)',
                overflow: 'hidden',
              }}
            >
              {d.before && (
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-2) var(--space-3)',
                    background: `color-mix(in srgb, ${semantic.removed} 7%, transparent)`,
                    boxShadow: `inset 2px 0 0 ${semantic.removed}`,
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      fontFamily: 'var(--font-code)',
                      color: 'var(--ink-faint)',
                      userSelect: 'none',
                      flexShrink: 0,
                    }}
                  >
                    −
                  </span>
                  <span
                    style={{
                      color: 'var(--ink-secondary)',
                      textDecoration: 'line-through',
                      textDecorationColor: 'color-mix(in srgb, var(--ink-faint) 70%, transparent)',
                    }}
                  >
                    {d.before}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-2) var(--space-3)',
                  background: `color-mix(in srgb, ${semantic.added} 8%, var(--chrome-surface))`,
                  boxShadow: `inset 2px 0 0 ${semantic.added}`,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    fontFamily: 'var(--font-code)',
                    color: semantic.added,
                    userSelect: 'none',
                    flexShrink: 0,
                  }}
                >
                  +
                </span>
                <span style={{ color: 'var(--ink-primary)' }}>{d.after}</span>
              </div>
            </div>

            {/* Trust line + action */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-3)',
                marginTop: 'var(--space-4)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.72rem',
                  color: 'var(--ink-faint)',
                }}
              >
                Unverified — nothing publishes until you Keep it.
              </span>
              <motion.button
                type="button"
                onClick={() => navigate(`/book/${bookId}/${d.chapterId}`)}
                whileTap={{ scale: 0.97 }}
                transition={spring.press}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: 44,
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--chrome-bg)',
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  letterSpacing: '0.01em',
                }}
              >
                Review in chapter
                <ArrowRight size={14} strokeWidth={2.25} aria-hidden />
              </motion.button>
            </div>
          </motion.article>
        ))}
      </div>
    </div>
  )
}
