/* ─── Toast Container ──────────────────────────────────────────────────
   Renders toast notifications in bottom-right corner.
   Animated with Framer Motion. Theme-aware.
   Render once in App.tsx: <ToastContainer />
────────────────────────────────────────────────────────────────────── */

import { AnimatePresence, motion } from 'framer-motion'
import { useToast, type ToastVariant } from '@/hooks/useToast'

const variantStyles: Record<ToastVariant, { color: string; bg: string; border: string }> = {
  success: {
    color: '#16a34a',
    bg: 'rgba(22, 163, 74, 0.08)',
    border: 'rgba(22, 163, 74, 0.3)',
  },
  error: {
    color: 'var(--color-error, #ef4444)',
    bg: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(239, 68, 68, 0.3)',
  },
  info: {
    color: 'var(--chrome-accent, var(--chrome-accent))',
    bg: 'rgba(47, 92, 138, 0.06)',
    border: 'var(--chrome-border, #1e293b)',
  },
}

const variantIcons: Record<ToastVariant, string> = {
  success: '\u2713',  // ✓
  error: '\u2717',    // ✗
  info: '\u2139',     // ℹ
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToast()

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 8,
        pointerEvents: 'none',
        maxWidth: 340,
      }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => {
          const vs = variantStyles[t.variant]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={() => removeToast(t.id)}
              style={{
                pointerEvents: 'auto',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderRadius: 8,
                background: `var(--chrome-bg, #0a0e17)`,
                border: `1px solid ${vs.border}`,
                backdropFilter: 'blur(12px)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              }}
            >
              <span style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: vs.color,
                lineHeight: 1,
                flexShrink: 0,
              }}>
                {variantIcons[t.variant]}
              </span>
              <span style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.8rem',
                color: 'var(--chrome-text, #94a3b8)',
                lineHeight: 1.4,
              }}>
                {t.message}
              </span>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
