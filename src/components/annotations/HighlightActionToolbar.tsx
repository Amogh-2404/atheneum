import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ─── Types ────────────────────────────────────────────────────────── */

interface HighlightActionToolbarProps {
  /** The highlight ID that was clicked */
  highlightId: string | null
  /** Current color of the highlight */
  currentColor: string
  /** Position (absolute, document coordinates) */
  x: number
  y: number
  /** Callbacks */
  onChangeColor: (id: string, color: string) => void
  onRemove: (id: string) => void
  onClose: () => void
}

/* ─── Highlight colours (same as AnnotationToolbar) ───────────────── */

const COLORS: { key: string; hex: string }[] = [
  { key: 'yellow', hex: '#FFEB3B' },
  { key: 'green', hex: '#4CAF50' },
  { key: 'blue', hex: '#42A5F5' },
  { key: 'pink', hex: '#EC407A' },
  { key: 'purple', hex: '#9575CD' },
]

/* ─── Component ───────────────────────────────────────────────────── */

export default function HighlightActionToolbar({
  highlightId,
  currentColor,
  x,
  y,
  onChangeColor,
  onRemove,
  onClose,
}: HighlightActionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null)

  // Viewport bounds checking
  const clampedX = Math.max(20, Math.min(x, typeof window !== 'undefined' ? window.innerWidth - 20 : x))
  // If toolbar would appear above viewport, flip it below the selection
  const scrollY = typeof window !== 'undefined' ? window.scrollY : 0
  const flippedBelow = (y - scrollY) < 0
  const finalY = flippedBelow ? y + 40 : y

  // Close on click outside
  useEffect(() => {
    if (!highlightId) return
    function handleMouseDown(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Small delay to avoid closing immediately from the same click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDown)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [highlightId, onClose])

  // Close on Escape
  useEffect(() => {
    if (!highlightId) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [highlightId, onClose])

  return (
    <AnimatePresence>
      {highlightId && (
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, scale: 0.85, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 4 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            left: clampedX,
            top: finalY,
            transform: flippedBelow
              ? 'translate(-50%, 0%)'
              : 'translate(-50%, -100%)',
            zIndex: 100,
            background: 'var(--chrome-surface, #111827)',
            border: '1px solid var(--chrome-border, #1e293b)',
            borderRadius: 20,
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            userSelect: 'none',
          }}
        >
          {/* Colour circles — click to change color */}
          {COLORS.map((c) => (
            <button
              key={c.key}
              title={`Change to ${c.key}`}
              onClick={() => {
                onChangeColor(highlightId, c.key)
                onClose()
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                margin: '-4px -6px',
              }}
              onMouseEnter={(e) => {
                const circle = e.currentTarget.firstElementChild as HTMLElement
                if (circle) {
                  circle.style.borderColor = '#fff'
                  circle.style.transform = 'scale(1.2)'
                }
              }}
              onMouseLeave={(e) => {
                const circle = e.currentTarget.firstElementChild as HTMLElement
                if (circle && c.key !== currentColor) {
                  circle.style.borderColor = 'transparent'
                  circle.style.transform = 'scale(1)'
                }
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: c.hex,
                  border: c.key === currentColor
                    ? '2px solid #fff'
                    : '2px solid transparent',
                  display: 'block',
                  transition: 'border-color 150ms ease, transform 150ms ease',
                  pointerEvents: 'none',
                  transform: c.key === currentColor ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            </button>
          ))}

          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 16,
              background: 'var(--chrome-border, #1e293b)',
              margin: '0 2px',
            }}
          />

          {/* Remove button */}
          <button
            title="Remove highlight"
            onClick={() => {
              onRemove(highlightId)
              onClose()
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 10,
              margin: -8,
              display: 'flex',
              alignItems: 'center',
              color: 'var(--chrome-text, #94a3b8)',
              transition: 'color 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#f87171'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--chrome-text, #94a3b8)'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
