import { motion } from 'framer-motion'

interface RewrittenChipProps {
  /** Open the old-vs-new review diff for this block. */
  onReview: () => void
  /**
   * True when this block also carries a confusion marker (which lives at the same
   * left:-28 top:0 gutter slot). When set, the chip drops below it so the two
   * never overlap — the confusion dot (the cause) stays on top.
   */
  confusionPresent?: boolean
}

/**
 * Subtle "rewritten — review" chip. Shown on a published block when an AI-authored
 * status:'draft' replacement exists for it (linked via metadata.insertedAfter).
 * Clicking it opens the VersionTimeline diff in draft-review mode. Styled to sit
 * in the same left gutter as ConfusionIndicator, but reads as an actionable label.
 * When a confusion marker shares the gutter, it stacks below it (top:26).
 */
export default function RewrittenChip({ onReview, confusionPresent = false }: RewrittenChipProps) {
  return (
    <motion.button
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      onClick={onReview}
      title="rewritten from your confusion — review"
      style={{
        position: 'absolute',
        top: confusionPresent ? 26 : 0,
        left: -28,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        height: 22,
        padding: '0 8px',
        borderRadius: 11,
        background: 'rgba(47, 92, 138, 0.12)',
        border: '1px solid rgba(47, 92, 138, 0.4)',
        color: 'var(--chrome-accent, var(--chrome-accent))',
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
        fontSize: '0.62rem',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        transition: 'background 150ms ease, border-color 150ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(47, 92, 138, 0.22)'
        e.currentTarget.style.borderColor = 'rgba(47, 92, 138, 0.7)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(47, 92, 138, 0.12)'
        e.currentTarget.style.borderColor = 'rgba(47, 92, 138, 0.4)'
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
      rewritten — review
    </motion.button>
  )
}
