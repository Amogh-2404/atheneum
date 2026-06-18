import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { StickyNote, Copy, Check, Trash2 } from 'lucide-react'

interface HighlightActionToolbarProps {
  highlightId: string | null
  currentColor: string
  selectedText?: string
  note?: string
  x: number
  y: number
  onChangeColor: (id: string, color: string) => void
  onUpdateNote: (id: string, note: string) => void
  onRemove: (id: string) => void
  onClose: () => void
}

const COLORS: { key: string; hex: string }[] = [
  { key: 'yellow', hex: '#FFEB3B' },
  { key: 'green', hex: '#4CAF50' },
  { key: 'blue', hex: '#42A5F5' },
  { key: 'pink', hex: '#EC407A' },
  { key: 'purple', hex: '#9575CD' },
]

export default function HighlightActionToolbar({
  highlightId,
  currentColor,
  selectedText,
  note,
  x,
  y,
  onChangeColor,
  onUpdateNote,
  onRemove,
  onClose,
}: HighlightActionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteVal, setNoteVal] = useState(note ?? '')
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const clampedX = Math.max(20, x)
  const flippedBelow = y < 0
  const finalY = flippedBelow ? y + 48 : y

  // Reset transient state whenever a different highlight is targeted.
  useEffect(() => {
    setCopied(false)
    setNoteOpen(false)
    setNoteVal(note ?? '')
  }, [highlightId, note])

  useEffect(() => {
    if (noteOpen) noteRef.current?.focus()
  }, [noteOpen])

  // Close on outside press, Escape, and scroll-away (so it never floats orphaned).
  useEffect(() => {
    if (!highlightId) return
    function onDown(e: MouseEvent | TouchEvent) {
      if (toolbarRef.current && e.target instanceof Node && !toolbarRef.current.contains(e.target)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    const onScroll = () => onClose()
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onDown)
      document.addEventListener('touchstart', onDown)
      // PAGE scroll only (no capture) so a code block / table scrolling underneath the
      // popover doesn't close it; bound after open so the opening tap can't self-close.
      window.addEventListener('scroll', onScroll, { passive: true })
    }, 50)
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll)
    }
  }, [highlightId, onClose])

  const iconBtn = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer',
    minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--ink-secondary)', transition: 'color 150ms ease', ...extra,
  })

  const copy = () => {
    if (selectedText) navigator.clipboard?.writeText(selectedText).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  const saveNote = () => {
    if (highlightId) onUpdateNote(highlightId, noteVal.trim())
    onClose()
  }

  return (
    <AnimatePresence>
      {highlightId && (
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, scale: 0.9, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 4 }}
          transition={{ type: 'spring', stiffness: 520, damping: 32 }}
          style={{
            position: 'absolute', left: clampedX, top: finalY,
            transform: flippedBelow ? 'translate(-50%, 0%)' : 'translate(-50%, -100%)',
            zIndex: 100, background: 'var(--surface-raised)', border: 'var(--hairline)',
            borderRadius: 16, padding: noteOpen ? '8px 10px' : '6px 10px',
            display: 'flex', flexDirection: 'column', gap: 8,
            boxShadow: 'var(--shadow-2)', userSelect: 'none', width: noteOpen ? 264 : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {COLORS.map((c) => (
              <button
                type="button" key={c.key} title={`Change to ${c.key}`}
                onClick={() => { onChangeColor(highlightId, c.key); onClose() }}
                style={{ width: 44, height: 44, borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, margin: '-2px -4px' }}
              >
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: c.hex, border: c.key === currentColor ? '2px solid var(--ink-primary)' : '2px solid transparent', display: 'block', transition: 'border-color 150ms ease, transform 150ms ease', pointerEvents: 'none', transform: c.key === currentColor ? 'scale(1.18)' : 'scale(1)' }} />
              </button>
            ))}
            <div style={{ width: 1, height: 16, background: 'var(--hairline-color, rgba(0,0,0,0.10))', margin: '0 2px' }} />
            <button type="button" title={note ? 'Edit note' : 'Add note'} onClick={() => setNoteOpen((v) => !v)}
              style={iconBtn(noteOpen || note ? { color: 'var(--accent)' } : undefined)}>
              <StickyNote size={16} strokeWidth={2} />
            </button>
            <button type="button" title="Copy text" onClick={copy} style={iconBtn(copied ? { color: '#5E8E6E' } : undefined)}>
              {copied ? <Check size={16} strokeWidth={2.4} /> : <Copy size={16} strokeWidth={2} />}
            </button>
            <button type="button" title="Remove highlight" onClick={() => { onRemove(highlightId); onClose() }}
              style={iconBtn()}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#c0556a' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-secondary)' }}>
              <Trash2 size={16} strokeWidth={2} />
            </button>
          </div>

          {noteOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <textarea
                ref={noteRef} value={noteVal} onChange={(e) => setNoteVal(e.target.value)}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveNote() }}
                placeholder="A note on this highlight…" rows={2}
                style={{ width: '100%', boxSizing: 'border-box', resize: 'none', fontFamily: 'var(--font-body)', fontSize: '15px', lineHeight: 1.45, color: 'var(--ink-primary)', background: 'var(--paper-bg)', border: 'var(--hairline)', borderRadius: 'var(--radius-2)', padding: '8px 10px', outline: 'none' }}
              />
              <button type="button" onClick={saveNote}
                style={{ alignSelf: 'flex-end', minHeight: 36, padding: '0 14px', fontFamily: 'var(--font-ui)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--paper-bg)', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-2)', cursor: 'pointer' }}>
                Save note
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
