/* ─── Keyboard Shortcut Overlay ────────────────────────────────────────
   Triggered by pressing ? in the Reader. Shows all available shortcuts.
────────────────────────────────────────────────────────────────────── */

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--chrome-bg, #0a0e17)',
              border: '1px solid var(--chrome-border, #1e293b)',
              borderRadius: 12,
              padding: '1.5rem 2rem',
              minWidth: 320,
              maxWidth: 420,
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
            }}
          >
            <h2 style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--chrome-accent, #52FEFE)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginTop: 0,
              marginBottom: '1.25rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid var(--chrome-border, #1e293b)',
            }}>
              Keyboard Shortcuts
            </h2>

            {shortcuts.map((group) => (
              <div key={group.category} style={{ marginBottom: '1rem' }}>
                <div style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'var(--chrome-text, #94a3b8)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: '0.4rem',
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
                      padding: '0.3rem 0',
                    }}
                  >
                    <span style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.85rem',
                      color: 'var(--chrome-text, #94a3b8)',
                    }}>
                      {item.desc}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {item.keys.map((k, j) => (
                        <kbd
                          key={j}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: 24,
                            height: 24,
                            padding: '0 6px',
                            fontFamily: 'var(--font-ui)',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: 'var(--chrome-accent, #52FEFE)',
                            background: 'rgba(82, 254, 254, 0.08)',
                            border: '1px solid rgba(82, 254, 254, 0.2)',
                            borderRadius: 4,
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
              fontSize: '0.7rem',
              color: 'var(--ink-faint)',
              marginTop: '0.5rem',
              letterSpacing: '0.03em',
            }}>
              Press any key to close
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
