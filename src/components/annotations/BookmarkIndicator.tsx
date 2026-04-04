import { motion } from 'framer-motion'
import type { Bookmark } from '@/hooks/useAnnotations'

interface BookmarkIndicatorProps {
  bookmark: Bookmark
  onRemove: () => void
}

export default function BookmarkIndicator({ bookmark, onRemove }: BookmarkIndicatorProps) {
  void bookmark

  return (
    <motion.button
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      onClick={onRemove}
      title="Bookmarked (click to remove)"
      style={{
        position: 'absolute',
        top: -2,
        right: -4,
        width: 16,
        height: 24,
        cursor: 'pointer',
        padding: 0,
        background: 'none',
        border: 'none',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
    >
      <svg
        width="14"
        height="20"
        viewBox="0 0 14 20"
        fill="var(--chrome-accent, #52FEFE)"
        stroke="none"
      >
        <path d="M0 0h14v20l-7-4.5L0 20V0z" />
      </svg>
    </motion.button>
  )
}
