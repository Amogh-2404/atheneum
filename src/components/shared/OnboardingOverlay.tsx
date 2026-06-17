import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ─── Constants ───────────────────────────────────────────────────── */

const STORAGE_KEY = 'atheneum-onboarded'
const TOTAL_STEPS = 3

/* ─── Shortcut data for Step 3 ────────────────────────────────────── */

const SHORTCUTS = [
  { keys: '\u2190 \u2192', label: 'Navigate chapters' },
  { keys: 't', label: 'Switch themes' },
  { keys: 'f', label: 'Focus mode' },
  { keys: 's', label: 'Toggle sidebar' },
  { keys: '\u2318K', label: 'Search' },
  { keys: 'g', label: 'Glossary' },
]

/* ─── OnboardingOverlay ───────────────────────────────────────────── */

export default function OnboardingOverlay() {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true)
      }
    } catch {
      /* localStorage unavailable — skip overlay */
    }
  }, [])

  const dismiss = useCallback(() => {
    setVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch { /* ignore */ }
  }, [])

  const next = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1)
    } else {
      dismiss()
    }
  }, [step, dismiss])

  const prev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1))
  }, [])

  /* Keyboard: Escape to skip, ArrowRight/Enter to advance */
  useEffect(() => {
    if (!visible) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [visible, next, prev, dismiss])

  if (!visible) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
          }}
          onClick={dismiss}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 520,
              maxWidth: '100%',
              background: 'var(--chrome-surface, #111827)',
              border: '1px solid var(--chrome-border, #1e293b)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow:
                '0 0 0 1px rgba(47, 92, 138, 0.06), 0 30px 80px rgba(0, 0, 0, 0.6), 0 0 40px rgba(47, 92, 138, 0.04)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* ─── Accent top bar ─── */}
            <div
              style={{
                height: 2,
                background: 'linear-gradient(90deg, transparent, var(--chrome-accent, var(--chrome-accent)), transparent)',
              }}
            />

            {/* ─── Step Content ─── */}
            <div
              style={{
                padding: '2.5rem 2rem 1.5rem',
                minHeight: 300,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <AnimatePresence mode="wait">
                {step === 0 && <StepWelcome key="welcome" />}
                {step === 1 && <StepHowItWorks key="how" />}
                {step === 2 && <StepShortcuts key="shortcuts" />}
              </AnimatePresence>
            </div>

            {/* ─── Bottom Nav ─── */}
            <div
              style={{
                padding: '1rem 2rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid var(--chrome-border, #1e293b)',
              }}
            >
              {/* Skip */}
              <button
                type="button"
                onClick={dismiss}
                style={{
                  background: 'none',
                  border: 'none',
                  fontFamily: "var(--font-ui, 'Inter', system-ui)",
                  fontSize: '0.82rem',
                  color: 'var(--chrome-text, #94a3b8)',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: 6,
                  transition: 'color 150ms ease',
                  letterSpacing: '0.02em',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--chrome-hover-text, #f1f5f9)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--chrome-text, #94a3b8)'
                }}
              >
                Skip
              </button>

              {/* Dot Indicators */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setStep(i)}
                    style={{
                      width: i === step ? 20 : 8,
                      height: 8,
                      borderRadius: 4,
                      background:
                        i === step
                          ? 'var(--chrome-accent, var(--chrome-accent))'
                          : 'var(--chrome-border, #1e293b)',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'all 250ms ease',
                    }}
                    aria-label={`Go to step ${i + 1}`}
                  />
                ))}
              </div>

              {/* Next / Done */}
              <button
                type="button"
                onClick={next}
                style={{
                  background: 'rgba(47, 92, 138, 0.1)',
                  border: '1px solid rgba(47, 92, 138, 0.25)',
                  fontFamily: "var(--font-ui, 'Inter', system-ui)",
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--chrome-accent, var(--chrome-accent))',
                  cursor: 'pointer',
                  padding: '8px 20px',
                  borderRadius: 8,
                  transition: 'background 150ms ease, border-color 150ms ease',
                  letterSpacing: '0.03em',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(47, 92, 138, 0.18)'
                  e.currentTarget.style.borderColor = 'rgba(47, 92, 138, 0.5)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(47, 92, 138, 0.1)'
                  e.currentTarget.style.borderColor = 'rgba(47, 92, 138, 0.25)'
                }}
              >
                {step === TOTAL_STEPS - 1 ? 'Done' : 'Next'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Step Components
   ═══════════════════════════════════════════════════════════════════════ */

const stepVariants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
}

const stepTransition = { duration: 0.25, ease: 'easeInOut' as const }

/* ─── Step 1: Welcome ─────────────────────────────────────────────── */

function StepWelcome() {
  return (
    <motion.div
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={stepTransition}
      style={{ textAlign: 'center', maxWidth: 400 }}
    >
      <div style={{ fontSize: '3.5rem', marginBottom: '1rem', lineHeight: 1 }}>
        {'\uD83D\uDCD6'}
      </div>
      <h2
        style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: '2.4rem',
          fontWeight: 700,
          color: 'var(--chrome-hover-text, #f1f5f9)',
          margin: '0 0 1rem 0',
          lineHeight: 1.2,
        }}
      >
        Welcome to Atheneum
      </h2>
      <p
        style={{
          fontFamily: "var(--font-ui, 'Inter', system-ui)",
          fontSize: '1rem',
          color: 'var(--chrome-text, #94a3b8)',
          lineHeight: 1.7,
          margin: 0,
        }}
      >
        Your personal learning notebook. Conversations with Claude produce
        beautiful, structured books you can read anywhere.
      </p>
    </motion.div>
  )
}

/* ─── Step 2: How It Works ────────────────────────────────────────── */

function StepHowItWorks() {
  const stages = [
    { icon: '\uD83D\uDCAC', label: 'You chat' },
    { icon: '\uD83D\uDCDD', label: 'Claude writes' },
    { icon: '\uD83D\uDCD6', label: 'Book updates' },
  ]

  return (
    <motion.div
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={stepTransition}
      style={{ textAlign: 'center', maxWidth: 420 }}
    >
      <h2
        style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: '2rem',
          fontWeight: 700,
          color: 'var(--chrome-hover-text, #f1f5f9)',
          margin: '0 0 2rem 0',
          lineHeight: 1.2,
        }}
      >
        How It Works
      </h2>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          marginBottom: '1.5rem',
        }}
      >
        {stages.map((s, i) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center' }}>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.15, duration: 0.35 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: 'rgba(47, 92, 138, 0.06)',
                  border: '1px solid rgba(47, 92, 138, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.8rem',
                }}
              >
                {s.icon}
              </div>
              <span
                style={{
                  fontFamily: "var(--font-ui, 'Inter', system-ui)",
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--chrome-text, #94a3b8)',
                  letterSpacing: '0.02em',
                }}
              >
                {s.label}
              </span>
            </motion.div>

            {/* Arrow between stages */}
            {i < stages.length - 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 + i * 0.15, duration: 0.3 }}
                style={{
                  fontFamily: "var(--font-ui, 'Inter', system-ui)",
                  fontSize: '1.2rem',
                  color: 'var(--chrome-accent, var(--chrome-accent))',
                  margin: '0 16px',
                  marginBottom: 24,
                  opacity: 0.6,
                }}
              >
                {'\u2192'}
              </motion.div>
            )}
          </div>
        ))}
      </div>

      <p
        style={{
          fontFamily: "var(--font-ui, 'Inter', system-ui)",
          fontSize: '0.9rem',
          color: 'var(--chrome-text, #94a3b8)',
          lineHeight: 1.6,
          margin: 0,
          opacity: 0.7,
        }}
      >
        Every conversation becomes a living document that updates in real time.
      </p>
    </motion.div>
  )
}

/* ─── Step 3: Quick Tips / Shortcuts ──────────────────────────────── */

function StepShortcuts() {
  return (
    <motion.div
      variants={stepVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={stepTransition}
      style={{ textAlign: 'center', width: '100%', maxWidth: 400 }}
    >
      <h2
        style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontSize: '2rem',
          fontWeight: 700,
          color: 'var(--chrome-hover-text, #f1f5f9)',
          margin: '0 0 1.5rem 0',
          lineHeight: 1.2,
        }}
      >
        Quick Tips
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px 16px',
        }}
      >
        {SHORTCUTS.map((sc, i) => (
          <motion.div
            key={sc.keys}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.06, duration: 0.3 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(47, 92, 138, 0.04)',
              border: '1px solid rgba(47, 92, 138, 0.08)',
            }}
          >
            <kbd
              style={{
                fontFamily: "var(--font-code, 'JetBrains Mono', monospace)",
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--chrome-accent, var(--chrome-accent))',
                background: 'rgba(47, 92, 138, 0.08)',
                border: '1px solid rgba(47, 92, 138, 0.15)',
                borderRadius: 4,
                padding: '2px 8px',
                minWidth: 36,
                textAlign: 'center',
                lineHeight: 1.6,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {sc.keys}
            </kbd>
            <span
              style={{
                fontFamily: "var(--font-ui, 'Inter', system-ui)",
                fontSize: '0.78rem',
                color: 'var(--chrome-text, #94a3b8)',
                textAlign: 'left',
                lineHeight: 1.3,
              }}
            >
              {sc.label}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
