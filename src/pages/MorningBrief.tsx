import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { tween } from '@/lib/motion'

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

function signalLabel(s: string): string {
  if (s.includes('reread')) return 'you re-read this'
  if (s.includes('dwell')) return 'you lingered here'
  if (s.includes('confusion')) return 'you flagged this'
  return 'a struggle signal'
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

  return (
    <div style={{ width: '100vw', minHeight: '100vh', background: 'var(--chrome-bg)', padding: 'var(--space-6) var(--space-5) var(--space-8)', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link to={bookId ? `/book/${bookId}` : '/'} style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--chrome-muted, var(--ink-faint))', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
          &larr; Back to reading
        </Link>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.2rem', fontWeight: 700, color: 'var(--chrome-accent)', margin: '0 0 6px', lineHeight: 1.1 }}>The Forge</h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.85rem', color: 'var(--chrome-text)', opacity: 0.6, margin: '0 0 28px', maxWidth: 520, lineHeight: 1.5 }}>
          Pages the book re-wrote from where you struggled. Nothing is published — each waits for your Keep.
        </p>

        {drafts === null && <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.85rem', color: 'var(--chrome-text)', opacity: 0.5 }}>Loading…</div>}

        {drafts !== null && drafts.length === 0 && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.95rem', color: 'var(--chrome-text)', opacity: 0.6, padding: '2rem 0' }}>
            Nothing re-forged. The book is reading clean.
          </div>
        )}

        {drafts?.map((d, i) => (
          <motion.div
            key={d.draftId}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...tween.enter, delay: Math.min(i * 0.04, 0.2) }}
            style={{ border: '1px solid var(--chrome-border)', borderRadius: 'var(--radius-3)', background: 'var(--chrome-surface)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--chrome-text)' }}>
                Ch.{d.chapterNumber} · {d.chapterTitle}
              </span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.68rem', color: 'var(--chrome-accent)', opacity: 0.85, whiteSpace: 'nowrap' }}>
                because {signalLabel(d.signal)}
              </span>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ borderLeft: '2px solid color-mix(in srgb, #f87171 60%, transparent)', paddingLeft: 12 }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--chrome-text)', opacity: 0.4, marginBottom: 3 }}>before</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--chrome-text)', opacity: 0.55, lineHeight: 1.5 }}>{d.before || <em>—</em>}</div>
              </div>
              <div style={{ borderLeft: '2px solid color-mix(in srgb, #34d399 65%, transparent)', paddingLeft: 12 }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--chrome-text)', opacity: 0.4, marginBottom: 3 }}>after — unverified</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--chrome-hover-text, #f1f5f9)', lineHeight: 1.5 }}>{d.after}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/book/${bookId}/${d.chapterId}`)}
              style={{ marginTop: 14, fontFamily: 'var(--font-ui)', fontSize: '0.76rem', fontWeight: 600, color: 'var(--chrome-bg)', background: 'var(--chrome-accent)', border: 'none', borderRadius: 'var(--radius-full)', padding: '7px 16px', cursor: 'pointer', letterSpacing: '0.02em' }}
            >
              Review in chapter &rarr;
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
