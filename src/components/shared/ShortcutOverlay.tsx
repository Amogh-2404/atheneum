/* ─── Keyboard Shortcut Overlay ────────────────────────────────────────
   Triggered by pressing ? in the Reader. Shows all available shortcuts.
────────────────────────────────────────────────────────────────────── */

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Keyboard } from 'lucide-react'

interface ShortcutOverlayProps {
  open: boolean
  onClose: () => void
}

const shortcuts = [
  {
    category: 'Navigation',
    items: [
      { keys: ['\u2190', '\u2192'], desc: 'Previous / Next chapter' },
    ],
  },
  {
    category: 'Reading',
    items: [
      { keys: ['t'], desc: 'Cycle themes' },
      { keys: ['f'], desc: 'Focus mode' },
      { keys: ['s'], desc: 'Toggle sidebar' },
    ],
  },
  {
    category: 'Tools',
    items: [
      { keys: ['\u2318', 'K'], desc: 'Search' },
      { keys: ['g'], desc: 'Glossary' },
      { keys: ['h'], desc: 'Version history' },
      { keys: ['p'], desc: 'Preferences' },
      { keys: ['?'], desc: 'This overlay' },
    ],
  },
]

export default function ShortcutOverlay({ open, onClose }: ShortcutOverlayProps) {
  // Close on any key press
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '?') {
        e.preventDefault()
        onClose()
      }
    }
    // Delay listener so the ? key that opened this doesn't immediately close it
    const timer = setTimeout(() => {
      window.addEventListener('keydown', handler)
    }, 100)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handler)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
            background: 'var(--chrome-glass)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
          }}
        >
          <motion.div
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 6, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Keyboard shortcuts"
            style={{
              background: 'var(--chrome-bg)',
              border: '1px solid var(--chrome-border)',
              borderRadius: 'var(--radius-3)',
              padding: 'var(--space-5) var(--space-6)',
              width: '100%',
              minWidth: 0,
              maxWidth: 420,
              boxShadow: 'var(--shadow-4)',
            }}
          >
            <h2 style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.25rem',
              fontWeight: 600,
              color: 'var(--chrome-accent)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              marginTop: 0,
              marginBottom: 'var(--space-4)',
              paddingBottom: 'var(--space-3)',
              borderBottom: '1px solid var(--chrome-border)',
            }}>
              <Keyboard size={18} strokeWidth={2} aria-hidden />
              Keyboard Shortcuts
            </h2>

            {shortcuts.map((group) => (
              <div key={group.category} style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'var(--chrome-accent)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 'var(--space-2)',
                }}>
                  {group.category}
                </div>
                {group.items.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-1) 0',
                    }}
                  >
                    <span style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.9rem',
                      color: 'var(--chrome-hover-text)',
                    }}>
                      {item.desc}
                    </span>
                    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                      {item.keys.map((k, j) => (
                        <kbd
                          key={j}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 24,
                            height: 24,
                            padding: '0 var(--space-2)',
                            fontFamily: 'var(--font-code)',
                            fontSize: '0.72rem',
                            fontWeight: 500,
                            color: 'var(--chrome-accent)',
                            background: 'var(--chrome-surface)',
                            border: '1px solid var(--chrome-border)',
                            borderRadius: 'var(--radius-1)',
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}

            <div style={{
              textAlign: 'center',
              fontFamily: 'var(--font-ui)',
              fontSize: '0.72rem',
              color: 'var(--chrome-text)',
              marginTop: 'var(--space-2)',
            }}>
              Press any key to close
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
