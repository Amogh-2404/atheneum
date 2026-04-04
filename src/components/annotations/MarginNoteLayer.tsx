import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { MarginNote } from '@/hooks/useAnnotations'

/* ─── Helpers ──────────────────────────────────────────────────────── */

/** Deterministic slight rotation from the note id, between -2 and 2 degrees */
function rotationFromId(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0
  }
  return (Math.abs(hash) % 40 - 20) / 10 // range: -2..2
}

/* ─── Single sticky note ──────────────────────────────────────────── */

function StickyNote({
  note,
  onRemove,
}: {
  note: MarginNote
  onRemove: () => void
}) {
  const rotation = rotationFromId(note.id)

  return (
    <motion.div
      initial={{ opacity: 0, x: 12, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 12, scale: 0.9 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        position: 'relative',
        width: 180,
        background: 'rgba(254, 243, 199, 0.85)',
        borderLeft: '3px solid #f59e0b',
        borderRadius: 2,
        padding: '8px 10px',
        transform: `rotate(${rotation}deg)`,
        boxShadow: '1px 2px 8px rgba(0,0,0,0.15)',
        marginBottom: 8,
      }}
    >
      {/* Close button */}
      <button
        onClick={onRemove}
        title="Remove note"
        style={{
          position: 'absolute',
          top: 2,
          right: 4,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#b45309',
          fontSize: '14px',
          lineHeight: 1,
          padding: 0,
          opacity: 0.5,
          transition: 'opacity 150ms ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '1'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.5'
        }}
      >
        x
      </button>

      {/* Note text */}
      <div
        style={{
          fontFamily: 'var(--font-handwritten, Caveat, cursive)',
          fontSize: '0.875rem',
          lineHeight: 1.45,
          color: '#78350f',
          wordBreak: 'break-word',
          paddingRight: 12,
        }}
      >
        {note.text}
      </div>

      {/* Timestamp */}
      <div
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '0.6rem',
          color: '#b45309',
          opacity: 0.5,
          marginTop: 4,
        }}
      >
        {new Date(note.createdAt).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        })}
      </div>
    </motion.div>
  )
}

/* ─── Margin Note Layer ────────────────────────────────────────────── */

interface MarginNoteLayerProps {
  notes: MarginNote[]
  onRemove: (id: string) => void
}

interface NotePosition {
  note: MarginNote
  top: number
}

export default function MarginNoteLayer({ notes, onRemove }: MarginNoteLayerProps) {
  const [positions, setPositions] = useState<NotePosition[]>([])

  // Calculate positions from block elements
  useEffect(() => {
    if (notes.length === 0) {
      setPositions([])
      return
    }

    // Small delay to let blocks render
    const timer = requestAnimationFrame(() => {
      const newPositions: NotePosition[] = []
      for (const note of notes) {
        const blockEl = document.getElementById(note.blockId)
        if (!blockEl) continue
        newPositions.push({
          note,
          top: blockEl.offsetTop,
        })
      }
      setPositions(newPositions)
    })

    return () => cancelAnimationFrame(timer)
  }, [notes])

  if (positions.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: -200,
        width: 190,
        pointerEvents: 'auto',
      }}
    >
      <AnimatePresence>
        {positions.map(({ note, top }) => (
          <div
            key={note.id}
            style={{
              position: 'absolute',
              top,
              left: 0,
            }}
          >
            <StickyNote
              note={note}
              onRemove={() => onRemove(note.id)}
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
