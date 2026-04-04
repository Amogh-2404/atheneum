import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface DraftActionBarProps {
  draftCount: number
  bookId: string
  chapterId: string
  draftBlockIds: string[]
  onApproveAll: () => void
  onDismissAll: () => void
}

export default function DraftActionBar({
  draftCount,
  bookId,
  chapterId,
  draftBlockIds,
  onApproveAll,
  onDismissAll,
}: DraftActionBarProps) {
  const [loading, setLoading] = useState<'approve' | 'dismiss' | null>(null)

  if (draftCount === 0) return null

  const handleApproveAll = async () => {
    setLoading('approve')
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockIds: draftBlockIds }),
      })
      if (res.ok) onApproveAll()
    } catch (err) {
      console.error('Failed to approve:', err)
    } finally {
      setLoading(null)
    }
  }

  const handleDismissAll = async () => {
    if (!window.confirm(`Dismiss ${draftCount} draft block${draftCount > 1 ? 's' : ''}? This will remove them.`)) return
    setLoading('dismiss')
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockIds: draftBlockIds }),
      })
      if (res.ok) onDismissAll()
    } catch (err) {
      console.error('Failed to dismiss:', err)
    } finally {
      setLoading(null)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        data-print-hide
        style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 90,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'var(--chrome-surface, #111827)',
          border: '1px solid var(--chrome-border, #1e293b)',
          borderRadius: 12,
          padding: '8px 16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          fontFamily: 'var(--font-ui)',
          userSelect: 'none',
        }}
      >
        {/* Draft count badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'var(--chrome-text, #94a3b8)',
          fontSize: '0.8rem',
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: 'rgba(82, 254, 254, 0.12)',
            color: 'var(--chrome-accent, #52FEFE)',
            fontSize: '0.7rem',
            fontWeight: 700,
          }}>
            {draftCount}
          </span>
          draft{draftCount > 1 ? 's' : ''}
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'var(--chrome-border)' }} />

        {/* Approve All */}
        <button
          onClick={handleApproveAll}
          disabled={loading !== null}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(74, 222, 128, 0.12)',
            border: '1px solid rgba(74, 222, 128, 0.25)',
            borderRadius: 8,
            padding: '5px 12px',
            color: '#4ade80',
            cursor: loading ? 'wait' : 'pointer',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.02em',
            transition: 'background 150ms ease',
            opacity: loading === 'dismiss' ? 0.4 : 1,
          }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'rgba(74, 222, 128, 0.2)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(74, 222, 128, 0.12)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {loading === 'approve' ? 'Approving...' : 'Approve All'}
        </button>

        {/* Dismiss All */}
        <button
          onClick={handleDismissAll}
          disabled={loading !== null}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'transparent',
            border: '1px solid rgba(248, 113, 113, 0.2)',
            borderRadius: 8,
            padding: '5px 12px',
            color: 'var(--color-error, #f87171)',
            cursor: loading ? 'wait' : 'pointer',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.75rem',
            fontWeight: 600,
            letterSpacing: '0.02em',
            transition: 'background 150ms ease',
            opacity: loading === 'approve' ? 0.4 : 1,
          }}
          onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'rgba(248, 113, 113, 0.08)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          {loading === 'dismiss' ? 'Removing...' : 'Dismiss All'}
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
