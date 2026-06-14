import { useState, type ReactNode } from 'react'

interface DraftIndicatorProps {
  isDraft: boolean
  blockId?: string
  bookId?: string
  chapterId?: string
  onApprove?: (blockId: string) => void
  onDismiss?: (blockId: string) => void
  children: ReactNode
}

export default function DraftIndicator({
  isDraft,
  blockId,
  bookId,
  chapterId,
  onApprove,
  onDismiss,
  children,
}: DraftIndicatorProps) {
  const [hovered, setHovered] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!isDraft) return <>{children}</>

  const handleApprove = async () => {
    if (!blockId || !bookId || !chapterId || loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockIds: [blockId] }),
      })
      if (res.ok && onApprove) onApprove(blockId)
    } catch (err) {
      console.error('Approve failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = async () => {
    if (!blockId || !bookId || !chapterId || loading) return
    if (!window.confirm('Dismiss this draft block? It will be removed.')) return
    setLoading(true)
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapterId}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockIds: [blockId] }),
      })
      if (res.ok && onDismiss) onDismiss(blockId)
    } catch (err) {
      console.error('Dismiss failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const showActions = hovered && blockId && bookId && chapterId

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Pencil watermark */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            letterSpacing: '0.2em',
            color: 'var(--color-error, #ef4444)',
            opacity: 0.08,
            transform: 'rotate(-20deg)',
            userSelect: 'none',
          }}
        >
          DRAFT
        </span>
      </div>

      {/* Draft border indicator */}
      <div style={{
        borderLeft: '3px dashed var(--chrome-accent, #52FEFE)',
        borderRadius: 2,
        paddingLeft: 2,
        opacity: loading ? 0.5 : 1,
        transition: 'opacity 200ms ease',
      }}>
        {children}
      </div>

      {/* Per-block approve/dismiss buttons on hover */}
      {showActions && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 20,
            display: 'flex',
            gap: 4,
          }}
        >
          <button
            type="button"
            onClick={handleApprove}
            disabled={loading}
            title="Approve this block"
            aria-label="Approve draft"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid rgba(74, 222, 128, 0.3)',
              background: 'rgba(74, 222, 128, 0.15)',
              color: '#4ade80',
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(74, 222, 128, 0.3)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(74, 222, 128, 0.15)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={loading}
            title="Dismiss this block"
            aria-label="Dismiss draft"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid rgba(248, 113, 113, 0.3)',
              background: 'rgba(248, 113, 113, 0.1)',
              color: 'var(--color-error, #f87171)',
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              transition: 'background 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248, 113, 113, 0.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(248, 113, 113, 0.1)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
