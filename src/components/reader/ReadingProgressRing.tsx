import { useEffect, useState } from 'react'

/**
 * The momentum cue static prose never gives you (Kindle's most-cited engagement
 * feature): a ring that fills as you move through the chapter, with minutes-left
 * computed from the reader's OWN measured pace (atheneum-wpm, set by telemetry).
 * Quiet, chrome-toned, out in the right margin — wayfinding, never a scoreboard.
 */
export default function ReadingProgressRing() {
  const [pct, setPct] = useState(0)
  const [totalWords, setTotalWords] = useState(0)

  useEffect(() => {
    const count = () => {
      let w = 0
      document.querySelectorAll('[data-block-id]').forEach((e) => {
        w += (e.textContent || '').trim().split(/\s+/).filter(Boolean).length
      })
      setTotalWords(w)
    }
    const t = setTimeout(count, 600)
    const onScroll = () => {
      const h = document.documentElement
      const max = h.scrollHeight - h.clientHeight
      setPct(max > 0 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { clearTimeout(t); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll) }
  }, [])

  const wpm = Number(localStorage.getItem('atheneum-wpm')) || 238
  const minsLeft = Math.max(0, Math.round((totalWords * (1 - pct)) / wpm))
  const R = 15
  const C = 2 * Math.PI * R

  return (
    <div
      className="reading-progress glass"
      title={`${Math.round(pct * 100)}% · ~${minsLeft} min left`}
      style={{
        position: 'fixed', right: 'var(--space-4)', bottom: 'calc(var(--space-5) + 72px)', zIndex: 40,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        padding: '8px 8px 6px', borderRadius: 'var(--radius-3)',
        background: 'var(--chrome-glass)', border: '1px solid var(--chrome-border)', boxShadow: 'var(--shadow-2)',
        backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
      }}
    >
      <svg width={38} height={38} style={{ display: 'block' }}>
        <circle cx={19} cy={19} r={R} fill="none" stroke="var(--chrome-border)" strokeWidth={2.5} />
        <circle
          cx={19} cy={19} r={R} fill="none" stroke="var(--chrome-accent)" strokeWidth={2.5} strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 19 19)"
          style={{ transition: 'stroke-dashoffset 140ms linear' }}
        />
        <text x={19} y={19} textAnchor="middle" dominantBaseline="central" style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 700, fill: 'var(--chrome-text)' }}>
          {Math.round(pct * 100)}
        </text>
      </svg>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.58rem', letterSpacing: '0.02em', color: 'var(--chrome-text)', opacity: 0.6, whiteSpace: 'nowrap' }}>
        {minsLeft} min
      </span>
    </div>
  )
}
