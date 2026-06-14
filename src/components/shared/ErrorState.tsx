/* ─── Error State Component ────────────────────────────────────────────
   Beautiful, themed error display with optional retry button.
   Replaces raw red error text throughout the app.
────────────────────────────────────────────────────────────────────── */

interface ErrorStateProps {
  message: string
  onRetry?: () => void
  icon?: 'warning' | 'error' | 'offline'
}

const icons = {
  warning: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  error: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  offline: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  ),
}

export default function ErrorState({ message, onRetry, icon = 'warning' }: ErrorStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: '3rem 2rem',
      minHeight: 200,
      textAlign: 'center',
    }}>
      <div style={{ color: 'var(--color-error, #ef4444)', opacity: 0.8 }}>
        {icons[icon]}
      </div>
      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: '1rem',
        color: 'var(--ink-secondary, #94a3b8)',
        lineHeight: 1.6,
        maxWidth: 400,
        margin: 0,
      }}>
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 4,
            fontFamily: 'var(--font-ui)',
            fontSize: '0.8rem',
            fontWeight: 600,
            letterSpacing: '0.03em',
            color: 'var(--chrome-accent, #52FEFE)',
            background: 'rgba(82, 254, 254, 0.08)',
            border: '1px solid var(--chrome-accent, #52FEFE)',
            borderRadius: 6,
            padding: '6px 16px',
            cursor: 'pointer',
            transition: 'background 150ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(82, 254, 254, 0.15)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(82, 254, 254, 0.08)' }}
        >
          Try again
        </button>
      )}
    </div>
  )
}
