type Origin = 'original' | 'ai-manual' | 'ai-improve-loop' | 'human-approved'

/**
 * A hairline provenance accent in the left margin rail. Marks where a block was
 * AI-authored (amber) or AI-authored-then-human-approved (green). Legacy blocks
 * with no origin show nothing. Honest, not decorative: a machine-mutable textbook
 * must visibly separate what the model wrote from what a human vetted. No green
 * tick on grounding it cannot prove — only "who wrote this," which it knows.
 */
export default function ProvenanceMark({ origin }: { origin: Origin }) {
  if (origin === 'original') return null
  const approved = origin === 'human-approved'
  const title = approved
    ? 'AI-authored, reviewed and kept by you'
    : origin === 'ai-improve-loop'
      ? 'Rewritten by the AI from a confusion signal — not yet verified'
      : 'AI-authored — not yet verified'
  return (
    <span
      title={title}
      aria-label={title}
      style={{
        position: 'absolute',
        left: -12,
        top: 2,
        bottom: 2,
        width: 2,
        borderRadius: 2,
        background: approved ? 'var(--color-success, #4ade80)' : 'var(--color-warning, #f59e0b)',
        opacity: 0.45,
        pointerEvents: 'auto',
      }}
    />
  )
}
