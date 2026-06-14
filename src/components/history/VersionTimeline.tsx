import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import DiffViewer from './DiffViewer'

export interface Commit {
  hash: string
  message: string
  date: string
}

interface Props {
  bookId: string
  chapterId: string
  commits: Commit[]
  currentChapter: any
  onClose: () => void
  onReverted: () => void
}

function useIsMobile(breakpoint = 768) {
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

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 30) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

export default function VersionTimeline({
  bookId,
  chapterId,
  commits,
  currentChapter,
  onClose,
  onReverted,
}: Props) {
  const isMobile = useIsMobile()
  const [selectedHash, setSelectedHash] = useState<string | null>(null)
  const [historicalChapter, setHistoricalChapter] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [reverting, setReverting] = useState(false)

  // Load historical version when a commit is selected
  useEffect(() => {
    if (!selectedHash) {
      setHistoricalChapter(null)
      return
    }

    setLoading(true)
    fetch(`/api/books/${bookId}/chapters/${chapterId}/history/${selectedHash}`)
      .then((res) => (res.ok ? res.json() : Promise.reject('not found')))
      .then((data) => {
        setHistoricalChapter(data)
        setLoading(false)
      })
      .catch(() => {
        setHistoricalChapter(null)
        setLoading(false)
      })
  }, [selectedHash, bookId, chapterId])

  const handleRevert = async () => {
    if (!selectedHash || reverting) return
    setReverting(true)
    try {
      const res = await fetch(
        `/api/books/${bookId}/chapters/${chapterId}/history/revert/${selectedHash}`,
        { method: 'POST' }
      )
      if (res.ok) {
        onReverted()
        onClose()
      }
    } catch {
      // silent
    }
    setReverting(false)
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          zIndex: 90,
        }}
      />

      {/* Panel */}
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: isMobile ? '100vw' : 460,
          maxWidth: isMobile ? '100vw' : '90vw',
          zIndex: 100,
          background: 'var(--chrome-bg)',
          borderLeft: '1px solid var(--chrome-border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--chrome-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: isMobile ? '1.25rem' : '1.5rem',
              fontWeight: 700,
              color: 'var(--chrome-accent)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Version History
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: isMobile ? 'rgba(82, 254, 254, 0.08)' : 'none',
              border: '1px solid var(--chrome-border)',
              borderRadius: isMobile ? 8 : 4,
              color: 'var(--chrome-text)',
              cursor: 'pointer',
              width: isMobile ? 44 : 28,
              height: isMobile ? 44 : 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? '20px' : '14px',
              fontFamily: 'var(--font-ui)',
              fontWeight: isMobile ? 700 : 400,
              transition: 'color 200ms ease, border-color 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--chrome-hover-text, #f1f5f9)'
              e.currentTarget.style.borderColor = 'var(--chrome-accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--chrome-text)'
              e.currentTarget.style.borderColor = 'var(--chrome-border)'
            }}
          >
            &times;
          </button>
        </div>

        {/* Commit count */}
        <div
          style={{
            padding: '0.5rem 1.5rem',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.7rem',
            color: 'var(--chrome-text)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {commits.length} version{commits.length !== 1 ? 's' : ''} tracked
        </div>

        {/* Timeline + Diff area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1.5rem' }}>
          {commits.length === 0 ? (
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '1rem',
                color: 'var(--chrome-text)',
                padding: '2rem 0',
                textAlign: 'center',
              }}
            >
              No version history for this chapter yet.
            </div>
          ) : (
            <>
              {/* Timeline */}
              <div style={{ position: 'relative', paddingLeft: 24 }}>
                {/* Vertical line */}
                <div
                  style={{
                    position: 'absolute',
                    left: 7,
                    top: 8,
                    bottom: 8,
                    width: 2,
                    background: 'var(--chrome-border)',
                    borderRadius: 1,
                  }}
                />

                {commits.map((commit, i) => {
                  const isSelected = selectedHash === commit.hash
                  const isFirst = i === 0
                  return (
                    <button
                      type="button"
                      key={commit.hash}
                      onClick={() => setSelectedHash(isSelected ? null : commit.hash)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        background: isSelected
                          ? 'rgba(82, 254, 254, 0.08)'
                          : 'none',
                        border: isSelected
                          ? '1px solid rgba(82, 254, 254, 0.25)'
                          : '1px solid transparent',
                        padding: '0.6rem 0.75rem',
                        borderRadius: 6,
                        cursor: 'pointer',
                        marginBottom: 4,
                        position: 'relative',
                        transition: 'background 150ms ease, border-color 150ms ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'rgba(82, 254, 254, 0.04)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'none'
                        }
                      }}
                    >
                      {/* Node dot */}
                      <div
                        style={{
                          position: 'absolute',
                          left: -20,
                          top: 14,
                          width: isSelected ? 12 : 10,
                          height: isSelected ? 12 : 10,
                          borderRadius: '50%',
                          background: isSelected
                            ? 'var(--chrome-accent)'
                            : isFirst
                            ? '#4ade80'
                            : 'var(--chrome-border)',
                          border: isSelected
                            ? '2px solid var(--chrome-accent)'
                            : '2px solid var(--chrome-surface, #1a1a2e)',
                          boxShadow: isSelected
                            ? '0 0 8px rgba(82, 254, 254, 0.4)'
                            : 'none',
                          transition: 'all 200ms ease',
                        }}
                      />

                      {/* Hash + time */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 2,
                        }}
                      >
                        <code
                          style={{
                            fontFamily: 'var(--font-mono, monospace)',
                            fontSize: '0.72rem',
                            color: isSelected ? 'var(--chrome-accent)' : '#94a3b8',
                            letterSpacing: '0.03em',
                            transition: 'color 200ms ease',
                          }}
                        >
                          {commit.hash.slice(0, 7)}
                        </code>
                        {isFirst && (
                          <span
                            style={{
                              fontFamily: 'var(--font-ui)',
                              fontSize: '0.6rem',
                              color: '#4ade80',
                              background: 'rgba(74, 222, 128, 0.1)',
                              padding: '1px 6px',
                              borderRadius: 3,
                              fontWeight: 600,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                            }}
                          >
                            latest
                          </span>
                        )}
                        <span
                          style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: '0.68rem',
                            color: 'var(--chrome-text)',
                            marginLeft: 'auto',
                            flexShrink: 0,
                          }}
                        >
                          {relativeTime(commit.date)}
                        </span>
                      </div>

                      {/* Message */}
                      <div
                        style={{
                          fontFamily: 'var(--font-ui)',
                          fontSize: '0.8rem',
                          color: isSelected ? '#e2e8f0' : 'var(--chrome-text)',
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          transition: 'color 200ms ease',
                        }}
                      >
                        {commit.message.replace(/^\[(codex|atheneum)\]\s*/i, '')}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Diff viewer (when commit is selected) */}
              {selectedHash && (
                <div style={{ marginTop: '1.25rem' }}>
                  {loading ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem 0',
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          border: '2px solid var(--chrome-border)',
                          borderTopColor: 'var(--chrome-accent)',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                        }}
                      />
                    </div>
                  ) : historicalChapter ? (
                    <>
                      <DiffViewer
                        currentChapter={currentChapter}
                        historicalChapter={historicalChapter}
                      />

                      {/* Revert button */}
                      <button
                        type="button"
                        onClick={handleRevert}
                        disabled={reverting}
                        style={{
                          width: '100%',
                          padding: '0.65rem 1rem',
                          marginTop: '0.75rem',
                          fontFamily: 'var(--font-ui)',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          letterSpacing: '0.02em',
                          color: reverting ? 'var(--chrome-text)' : '#0a0e17',
                          background: reverting
                            ? 'var(--chrome-surface)'
                            : 'var(--chrome-accent)',
                          border: 'none',
                          borderRadius: 6,
                          cursor: reverting ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          transition: 'opacity 200ms ease',
                          opacity: reverting ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (!reverting) e.currentTarget.style.opacity = '0.85'
                        }}
                        onMouseLeave={(e) => {
                          if (!reverting) e.currentTarget.style.opacity = '1'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1 4 1 10 7 10" />
                          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                        </svg>
                        {reverting ? 'Reverting...' : `Revert to ${selectedHash.slice(0, 7)}`}
                      </button>
                    </>
                  ) : (
                    <div
                      style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '0.85rem',
                        color: '#f87171',
                        textAlign: 'center',
                        padding: '1rem 0',
                      }}
                    >
                      Could not load this version.
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Spinner keyframe */}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </motion.aside>
    </>
  )
}
