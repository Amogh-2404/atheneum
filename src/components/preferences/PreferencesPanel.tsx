import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'

/* ─── Types ────────────────────────────────────────────────────────── */

interface Preferences {
  fontSize: number       // rem value, 0.85 – 1.5
  dyslexiaMode: boolean
  reducedMotion: boolean
  theme: 'light' | 'dark' | 'sepia'
}

const DEFAULTS: Preferences = {
  fontSize: 1.1,
  dyslexiaMode: false,
  reducedMotion: false,
  theme: 'light',
}

const STORAGE_KEY = 'atheneum-preferences'

const THEMES: { key: Preferences['theme']; color: string; label: string }[] = [
  { key: 'light', color: '#faf8f3', label: 'Light' },
  { key: 'dark', color: '#1a1a2e', label: 'Dark' },
  { key: 'sepia', color: '#f4ecd8', label: 'Sepia' },
]

/* ─── Helpers ──────────────────────────────────────────────────────── */

function loadPreferences(): Preferences {
  let prefs = { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) prefs = { ...DEFAULTS, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  // Canonical theme source — atheneum-theme is written by applyToDOM on every change
  const savedTheme = localStorage.getItem('atheneum-theme') as Preferences['theme'] | null
  if (savedTheme) prefs.theme = savedTheme
  return prefs
}

function savePreferences(prefs: Preferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

function applyToDOM(prefs: Preferences) {
  const root = document.documentElement
  root.style.setProperty('--user-font-size', `${prefs.fontSize}rem`)

  if (prefs.dyslexiaMode) {
    root.setAttribute('data-dyslexia', 'true')
  } else {
    root.removeAttribute('data-dyslexia')
  }

  if (prefs.reducedMotion) {
    root.setAttribute('data-reduced-motion', 'true')
  } else {
    root.removeAttribute('data-reduced-motion')
  }

  root.setAttribute('data-theme', prefs.theme)
  localStorage.setItem('atheneum-theme', prefs.theme)
}

/* ─── Mobile detection ─────────────────────────────────────────────── */

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint
  )
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

/* ─── Toggle Switch ────────────────────────────────────────────────── */

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        padding: '0.5rem 0',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '0.85rem',
          color: '#e2e8f0',
          letterSpacing: '0.01em',
        }}
      >
        {label}
      </span>
      <div
        onClick={(e) => { e.preventDefault(); onChange(!checked) }}
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          background: checked ? 'var(--chrome-accent)' : 'var(--chrome-border)',
          position: 'relative',
          transition: 'background 200ms ease',
          flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: checked ? '#0a0a1a' : '#94a3b8',
            position: 'absolute',
            top: 3,
            left: checked ? 21 : 3,
            transition: 'left 200ms ease, background 200ms ease',
          }}
        />
      </div>
    </label>
  )
}

/* ─── PreferencesPanel ─────────────────────────────────────────────── */

interface Props {
  onClose: () => void
}

export default function PreferencesPanel({ onClose }: Props) {
  const isMobile = useIsMobile()
  const [prefs, setPrefs] = useState<Preferences>(loadPreferences)
  const [confirmingClear, setConfirmingClear] = useState(false)

  // Apply preferences to DOM on mount and whenever they change
  useEffect(() => {
    applyToDOM(prefs)
    savePreferences(prefs)
  }, [prefs])

  const update = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }))
  }, [])

  // Export annotations
  const handleExport = useCallback(() => {
    const raw = localStorage.getItem('atheneum-annotations')
    const data = raw ? JSON.parse(raw) : {}
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `atheneum-annotations-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // Clear all data
  const handleClearAll = useCallback(() => {
    localStorage.removeItem('atheneum-annotations')
    localStorage.removeItem('atheneum-last-read')
    localStorage.removeItem('atheneum-preferences')
    localStorage.removeItem('atheneum-theme')
    // Reset to defaults
    setPrefs({ ...DEFAULTS })
    applyToDOM(DEFAULTS)
    setConfirmingClear(false)
  }, [])

  // Section header style
  const sectionHeaderStyle: React.CSSProperties = {
    fontFamily: "'Rajdhani', var(--font-heading)",
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--chrome-accent)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    margin: '0 0 0.75rem 0',
  }

  const sectionStyle: React.CSSProperties = {
    padding: '1rem 0',
    borderBottom: '1px solid var(--chrome-border)',
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          zIndex: 90,
        }}
      />

      {/* Panel */}
      <motion.aside
        className="preferences-panel"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: isMobile ? '100vw' : 360,
          maxWidth: isMobile ? '100vw' : '90vw',
          zIndex: 100,
          background: 'var(--chrome-surface)',
          borderLeft: '1px solid var(--chrome-border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.3)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--chrome-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              fontFamily: "'Rajdhani', var(--font-heading)",
              fontSize: isMobile ? '1.25rem' : '1.5rem',
              fontWeight: 700,
              color: 'var(--chrome-accent)',
              margin: 0,
            }}
          >
            Preferences
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: isMobile ? 'rgba(82, 254, 254, 0.08)' : 'none',
              border: '1px solid var(--chrome-border)',
              borderRadius: isMobile ? 8 : 4,
              color: 'var(--chrome-text)',
              cursor: 'pointer',
              width: isMobile ? 44 : 28,
              height: isMobile ? 44 : 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? '20px' : '14px',
              fontFamily: 'var(--font-ui)',
              fontWeight: isMobile ? 700 : 400,
              transition: 'color 200ms ease, border-color 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--chrome-hover-text, #f1f5f9)'
              e.currentTarget.style.borderColor = 'var(--chrome-accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--chrome-text)'
              e.currentTarget.style.borderColor = 'var(--chrome-border)'
            }}
          >
            &times;
          </button>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0.5rem 1.5rem 1.5rem',
          }}
        >
          {/* ─── Reading ─── */}
          <div style={sectionStyle}>
            <h3 style={sectionHeaderStyle}>Reading</h3>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>Font Size</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--chrome-accent)',
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 48,
                  textAlign: 'right',
                }}
              >
                {prefs.fontSize.toFixed(2)}rem
              </span>
            </div>

            <input
              type="range"
              min={0.85}
              max={1.5}
              step={0.05}
              value={prefs.fontSize}
              onChange={(e) => update('fontSize', parseFloat(e.target.value))}
              style={{
                width: '100%',
                accentColor: 'var(--chrome-accent)',
                cursor: 'pointer',
                height: 4,
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.65rem',
                color: 'var(--chrome-text)',
                marginTop: 2,
              }}
            >
              <span>0.85</span>
              <span>1.50</span>
            </div>

            {/* Preview */}
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                background: 'rgba(82, 254, 254, 0.03)',
                borderRadius: 6,
                border: '1px solid var(--chrome-border)',
              }}
            >
              <p
                style={{
                  fontSize: `${prefs.fontSize}rem`,
                  fontFamily: 'var(--font-body)',
                  color: '#e2e8f0',
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                The quick brown fox jumps over the lazy dog.
              </p>
            </div>
          </div>

          {/* ─── Accessibility ─── */}
          <div style={sectionStyle}>
            <h3 style={sectionHeaderStyle}>Accessibility</h3>
            <Toggle
              label="Dyslexia-friendly font"
              checked={prefs.dyslexiaMode}
              onChange={(v) => update('dyslexiaMode', v)}
            />
            <Toggle
              label="Reduced motion"
              checked={prefs.reducedMotion}
              onChange={(v) => update('reducedMotion', v)}
            />
          </div>

          {/* ─── Theme ─── */}
          <div style={sectionStyle}>
            <h3 style={sectionHeaderStyle}>Theme</h3>
            <div style={{ display: 'flex', gap: 16, padding: '0.25rem 0' }}>
              {THEMES.map((t) => (
                <button
                  type="button"
                  key={t.key}
                  onClick={() => update('theme', t.key)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.4rem 0.6rem',
                    borderRadius: 8,
                    transition: 'background 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(82, 254, 254, 0.06)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none'
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: t.color,
                      border: prefs.theme === t.key
                        ? '3px solid var(--chrome-accent)'
                        : '2px solid var(--chrome-border)',
                      transition: 'border-color 200ms ease, transform 200ms ease',
                      transform: prefs.theme === t.key ? 'scale(1.1)' : 'scale(1)',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.7rem',
                      color: prefs.theme === t.key ? 'var(--chrome-accent)' : 'var(--chrome-text)',
                      fontWeight: prefs.theme === t.key ? 600 : 400,
                      letterSpacing: '0.02em',
                      transition: 'color 200ms ease',
                    }}
                  >
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ─── Data ─── */}
          <div style={{ ...sectionStyle, borderBottom: 'none' }}>
            <h3 style={sectionHeaderStyle}>Data</h3>

            <button
              type="button"
              onClick={handleExport}
              style={{
                width: '100%',
                padding: '0.6rem 1rem',
                fontFamily: 'var(--font-ui)',
                fontSize: '0.82rem',
                color: 'var(--chrome-accent)',
                background: 'rgba(82, 254, 254, 0.06)',
                border: '1px solid var(--chrome-border)',
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'background 150ms ease, border-color 150ms ease',
                marginBottom: 8,
                letterSpacing: '0.02em',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(82, 254, 254, 0.12)'
                e.currentTarget.style.borderColor = 'var(--chrome-accent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(82, 254, 254, 0.06)'
                e.currentTarget.style.borderColor = 'var(--chrome-border)'
              }}
            >
              Export Annotations
            </button>

            {!confirmingClear ? (
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                style={{
                  width: '100%',
                  padding: '0.6rem 1rem',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.82rem',
                  color: '#f87171',
                  background: 'rgba(248, 113, 113, 0.06)',
                  border: '1px solid rgba(248, 113, 113, 0.2)',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'background 150ms ease, border-color 150ms ease',
                  letterSpacing: '0.02em',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(248, 113, 113, 0.12)'
                  e.currentTarget.style.borderColor = 'rgba(248, 113, 113, 0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(248, 113, 113, 0.06)'
                  e.currentTarget.style.borderColor = 'rgba(248, 113, 113, 0.2)'
                }}
              >
                Clear All Data
              </button>
            ) : (
              <div
                style={{
                  padding: '0.75rem',
                  background: 'rgba(248, 113, 113, 0.08)',
                  border: '1px solid rgba(248, 113, 113, 0.3)',
                  borderRadius: 6,
                }}
              >
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: '#fca5a5',
                    margin: '0 0 0.5rem 0',
                    lineHeight: 1.5,
                  }}
                >
                  This will permanently delete all annotations, bookmarks, notes, and reading progress. Are you sure?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.78rem',
                      color: '#fff',
                      background: '#dc2626',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Yes, clear everything
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingClear(false)}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.78rem',
                      color: 'var(--chrome-text)',
                      background: 'none',
                      border: '1px solid var(--chrome-border)',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Slider thumb styling — scoped to the panel so it never leaks to reactive-math sliders */}
      <style>{`
        .preferences-panel input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: var(--chrome-border);
          border-radius: 2px;
          outline: none;
        }
        .preferences-panel input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--chrome-accent);
          cursor: pointer;
          border: 2px solid var(--chrome-surface);
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        .preferences-panel input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--chrome-accent);
          cursor: pointer;
          border: 2px solid var(--chrome-surface);
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
      `}</style>
    </>
  )
}

/* ─── Init: Apply saved preferences on app load ────────────────────── */
export function initPreferences() {
  const prefs = loadPreferences()
  applyToDOM(prefs)
}
