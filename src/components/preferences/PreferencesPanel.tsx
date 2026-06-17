import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X, Download, Trash2, AlertTriangle } from 'lucide-react'

/* ─── Types ────────────────────────────────────────────────────────── */

/* Destructive intent — not the brand accent; consolidated so the red lives
   in exactly one place rather than sprayed across button styles. */
const DANGER = {
  text: '#dc2626',
  textSoft: '#b91c1c',
  surface: 'color-mix(in srgb, #dc2626 8%, transparent)',
  surfaceHover: 'color-mix(in srgb, #dc2626 14%, transparent)',
  border: 'color-mix(in srgb, #dc2626 24%, transparent)',
  borderHover: 'color-mix(in srgb, #dc2626 44%, transparent)',
}

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

// Swatch colours mirror each theme's actual --paper-bg so the preview reads true.
const THEMES: { key: Preferences['theme']; color: string; label: string }[] = [
  { key: 'light', color: '#faf8f3', label: 'Light' },
  { key: 'dark', color: '#16161A', label: 'Dark' },
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
          color: 'var(--chrome-hover-text)',
        }}
      >
        {label}
      </span>
      <div
        onClick={(e) => { e.preventDefault(); onChange(!checked) }}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        style={{
          width: 44,
          height: 24,
          minHeight: 24,
          borderRadius: 'var(--radius-4)',
          background: checked ? 'var(--chrome-accent)' : 'var(--chrome-border)',
          position: 'relative',
          transition: 'background 200ms ease',
          flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: checked ? 'var(--chrome-bg)' : 'var(--chrome-text)',
            position: 'absolute',
            top: 3,
            left: checked ? 23 : 3,
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

  // Section header style — uppercase eyebrow, the one place tracking is allowed
  const sectionHeaderStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--chrome-accent)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    margin: '0 0 var(--space-3) 0',
  }

  const sectionStyle: React.CSSProperties = {
    padding: 'var(--space-4) 0',
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
          background: 'var(--chrome-glass)',
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
          boxShadow: 'var(--shadow-4)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--space-5) var(--space-5)',
            borderBottom: '1px solid var(--chrome-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: isMobile ? '1.25rem' : '1.5rem',
              fontWeight: 600,
              color: 'var(--chrome-accent)',
              margin: 0,
            }}
          >
            Preferences
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preferences"
            style={{
              background: isMobile ? 'var(--chrome-bg)' : 'none',
              border: '1px solid var(--chrome-border)',
              borderRadius: 'var(--radius-2)',
              color: 'var(--chrome-text)',
              cursor: 'pointer',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'color 200ms ease, border-color 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--chrome-hover-text)'
              e.currentTarget.style.borderColor = 'var(--chrome-accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--chrome-text)'
              e.currentTarget.style.borderColor = 'var(--chrome-border)'
            }}
          >
            <X size={18} strokeWidth={2} aria-hidden />
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

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--chrome-hover-text)' }}>Font Size</span>
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
                marginTop: 'var(--space-3)',
                padding: 'var(--space-3)',
                background: 'var(--chrome-bg)',
                borderRadius: 'var(--radius-2)',
                border: '1px solid var(--chrome-border)',
              }}
            >
              <p
                style={{
                  fontSize: `${prefs.fontSize}rem`,
                  fontFamily: 'var(--font-body)',
                  color: 'var(--chrome-hover-text)',
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
            <div style={{ display: 'flex', gap: 'var(--space-4)', padding: 'var(--space-1) 0' }}>
              {THEMES.map((t) => {
                const active = prefs.theme === t.key
                return (
                  <button
                    type="button"
                    key={t.key}
                    onClick={() => update('theme', t.key)}
                    aria-pressed={active}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 'var(--space-2)',
                      minHeight: 44,
                      borderRadius: 'var(--radius-2)',
                      transition: 'background 150ms ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--chrome-bg)'
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
                        border: active
                          ? '2px solid var(--chrome-accent)'
                          : '1px solid var(--chrome-border)',
                        boxShadow: active ? '0 0 0 2px var(--chrome-surface), 0 0 0 3px var(--chrome-accent)' : 'none',
                        transition: 'border-color 200ms ease, box-shadow 200ms ease',
                      }}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--font-ui)',
                        fontSize: '0.7rem',
                        color: active ? 'var(--chrome-accent)' : 'var(--chrome-text)',
                        fontWeight: active ? 600 : 400,
                        transition: 'color 200ms ease',
                      }}
                    >
                      {t.label}
                    </span>
                  </button>
                )
              })}
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
                minHeight: 44,
                padding: 'var(--space-2) var(--space-4)',
                fontFamily: 'var(--font-ui)',
                fontSize: '0.82rem',
                color: 'var(--chrome-accent)',
                background: 'var(--chrome-bg)',
                border: '1px solid var(--chrome-border)',
                borderRadius: 'var(--radius-2)',
                cursor: 'pointer',
                transition: 'background 150ms ease, border-color 150ms ease',
                marginBottom: 'var(--space-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--space-2)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--chrome-surface)'
                e.currentTarget.style.borderColor = 'var(--chrome-accent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--chrome-bg)'
                e.currentTarget.style.borderColor = 'var(--chrome-border)'
              }}
            >
              <Download size={15} strokeWidth={2} aria-hidden />
              Export Annotations
            </button>

            {!confirmingClear ? (
              <button
                type="button"
                onClick={() => setConfirmingClear(true)}
                style={{
                  width: '100%',
                  minHeight: 44,
                  padding: 'var(--space-2) var(--space-4)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.82rem',
                  color: DANGER.text,
                  background: DANGER.surface,
                  border: `1px solid ${DANGER.border}`,
                  borderRadius: 'var(--radius-2)',
                  cursor: 'pointer',
                  transition: 'background 150ms ease, border-color 150ms ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 'var(--space-2)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = DANGER.surfaceHover
                  e.currentTarget.style.borderColor = DANGER.borderHover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = DANGER.surface
                  e.currentTarget.style.borderColor = DANGER.border
                }}
              >
                <Trash2 size={15} strokeWidth={2} aria-hidden />
                Clear All Data
              </button>
            ) : (
              <div
                style={{
                  padding: 'var(--space-3)',
                  background: DANGER.surface,
                  border: `1px solid ${DANGER.border}`,
                  borderRadius: 'var(--radius-2)',
                }}
              >
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: DANGER.text,
                    margin: '0 0 var(--space-2) 0',
                    lineHeight: 1.5,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--space-2)',
                  }}
                >
                  <AlertTriangle size={16} strokeWidth={2} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
                  This will permanently delete all annotations, bookmarks, notes, and reading progress. Are you sure?
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      padding: 'var(--space-2)',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.78rem',
                      color: 'var(--chrome-bg)',
                      background: DANGER.text,
                      border: 'none',
                      borderRadius: 'var(--radius-1)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      transition: 'background 150ms ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = DANGER.textSoft }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = DANGER.text }}
                  >
                    Yes, clear everything
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingClear(false)}
                    style={{
                      flex: 1,
                      minHeight: 44,
                      padding: 'var(--space-2)',
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.78rem',
                      color: 'var(--chrome-text)',
                      background: 'none',
                      border: '1px solid var(--chrome-border)',
                      borderRadius: 'var(--radius-1)',
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
          border-radius: var(--radius-1);
          outline: none;
        }
        .preferences-panel input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--chrome-accent);
          cursor: pointer;
          border: 2px solid var(--chrome-surface);
          box-shadow: var(--shadow-1);
        }
        .preferences-panel input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--chrome-accent);
          cursor: pointer;
          border: 2px solid var(--chrome-surface);
          box-shadow: var(--shadow-1);
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
