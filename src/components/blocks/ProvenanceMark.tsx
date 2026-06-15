import { useState } from 'react'

type Origin = 'original' | 'ai-manual' | 'ai-improve-loop' | 'human-approved'

/**
 * A provenance accent in the left margin rail. Marks where a block was AI-authored
 * (amber) or AI-authored-then-human-approved (green). Legacy blocks with no origin
 * show nothing. Honest, not decorative: a machine-mutable textbook must visibly
 * separate what the model wrote from what a human vetted. On hover it widens and
 * reveals an inline label so the amber/green meaning is recoverable without relying
 * on a tooltip (tooltips don't exist on touch). No green tick on grounding it can't
 * prove — only "who wrote this," which it knows.
 */
export default function ProvenanceMark({ origin }: { origin: Origin }) {
  const [hover, setHover] = useState(false)
  if (origin === 'original') return null
  const approved = origin === 'human-approved'
  const color = approved ? 'var(--color-success, #4ade80)' : 'var(--color-warning, #f59e0b)'
  const title = approved
    ? 'AI-authored, reviewed and kept by you'
    : origin === 'ai-improve-loop'
      ? 'Rewritten by the AI from a confusion signal — not yet verified'
      : 'AI-authored — not yet verified'
  const label = approved ? 'AI · kept' : 'AI · unverified'
  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={title}
      style={{ position: 'absolute', left: -14, top: 0, bottom: 0, width: 12 }}
    >
      <span
        style={{
          position: 'absolute',
          left: 2,
          top: 2,
          bottom: 2,
          width: hover ? 4 : 3,
          borderRadius: 2,
          background: color,
          opacity: hover ? 0.95 : 0.7,
          transition: 'width 120ms ease, opacity 120ms ease',
        }}
      />
      {hover && (
        <span
          style={{
            position: 'absolute',
            right: 'calc(100% + 6px)',
            top: 0,
            whiteSpace: 'nowrap',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.56rem',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color,
            padding: '2px 6px',
            borderRadius: 4,
            background: 'var(--chrome-surface, #111827)',
            border: `1px solid ${color}`,
          }}
        >
          {label}
        </span>
      )}
    </span>
  )
}
