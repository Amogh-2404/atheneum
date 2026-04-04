import { motion } from 'framer-motion'
import type { ConfusionMarker } from '@/hooks/useAnnotations'

interface ConfusionIndicatorProps {
  marker: ConfusionMarker
  onRemove: () => void
}

export default function ConfusionIndicator({ marker, onRemove }: ConfusionIndicatorProps) {
  // suppress unused-var lint — marker is kept for future note display
  void marker

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.15 }}
      onClick={onRemove}
      title="Marked as confusing (click to remove)"
      style={{
        position: 'absolute',
        top: 0,
        left: -28,
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: 'rgba(245, 158, 11, 0.15)',
        border: '1.5px solid rgba(245, 158, 11, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        fontSize: '12px',
        lineHeight: 1,
        transition: 'background 150ms ease, border-color 150ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(245, 158, 11, 0.3)'
        e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.8)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)'
        e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.5)'
      }}
    >
      <span style={{ color: '#f59e0b' }}>?</span>
    </motion.button>
  )
}
