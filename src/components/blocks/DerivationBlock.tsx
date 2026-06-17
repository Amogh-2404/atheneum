import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { renderText } from '@/lib/render-text'
import { tween } from '@/lib/motion'
import type { DerivationBlock as DerivationBlockType } from '@/types'

// trust:false + throwOnError mirror MathBlock exactly (G9); raw-LaTeX fallback on error.
function renderLatex(latex: string): { html: string; error: boolean } {
  try {
    return { html: katex.renderToString(latex, { displayMode: true, throwOnError: true, trust: false }), error: false }
  } catch {
    return { html: '', error: true }
  }
}

/**
 * A derivation revealed ONE step at a time — you set the pace (Next / Back), which
 * is both the most robust mobile interaction (no scroll-sync, no sticky) and the
 * better way to follow an argument. Every line is rendered up front (space reserved,
 * so a reveal never reflows); unrevealed lines are simply transparent. The newest
 * line is washed with the accent and its changed term is shown as a Δ chip.
 */
export default function DerivationBlock(props: DerivationBlockType & { bookId?: string; chapterId?: string }) {
  const { title, lines, caption } = props
  const [revealed, setRevealed] = useState(1)
  const rendered = useMemo(() => lines.map((l) => renderLatex(l.latex)), [lines])
  const deltas = useMemo(() => lines.map((l) => (l.delta ? renderLatex(l.delta) : null)), [lines])
  const atEnd = revealed >= lines.length
  const newest = revealed - 1

  return (
    <figure className="derivation not-prose" style={{ margin: 'var(--space-7) 0', padding: 'var(--space-5) var(--space-5) var(--space-4)', borderRadius: 'var(--radius-3)', border: 'var(--hairline)', background: 'var(--surface-raised)', boxShadow: 'var(--shadow-1)' }}>
      {title && (
        <figcaption style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-4)', fontFamily: 'var(--font-ui)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)' }}>
          <Sparkles size={12} strokeWidth={2.2} /> {renderText(title)}
        </figcaption>
      )}

      <div>
        {lines.map((line, i) => {
          const shown = i < revealed
          const isNewest = i === newest
          return (
            <div
              key={i}
              aria-hidden={!shown}
              style={{
                opacity: shown ? 1 : 0,
                transition: 'opacity 380ms ease',
                margin: '0 0 var(--space-3)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-2)',
                background: isNewest && shown ? 'color-mix(in oklab, var(--accent) 9%, transparent)' : 'transparent',
                borderLeft: isNewest && shown ? '2px solid var(--accent)' : '2px solid transparent',
                transitionProperty: 'opacity, background, border-color',
              }}
            >
              <div className="math-display" style={{ overflowX: 'auto', overflowY: 'hidden', overscrollBehaviorX: 'contain', WebkitOverflowScrolling: 'touch', color: shown && !isNewest ? 'var(--ink-secondary)' : 'var(--ink-primary)' }}>
                {rendered[i].error
                  ? <span className="math-error">{line.latex}</span>
                  : <div dangerouslySetInnerHTML={{ __html: rendered[i].html }} />}
              </div>
              {isNewest && shown && (line.note || deltas[i]) && (
                <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={tween.enter} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  {deltas[i] && !deltas[i]!.error && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 'var(--radius-1)', background: 'color-mix(in oklab, var(--accent) 14%, transparent)', fontSize: '0.78rem', color: 'var(--accent)' }}>
                      <span style={{ fontWeight: 700 }}>Δ</span>
                      <span className="eq-delta" dangerouslySetInnerHTML={{ __html: deltas[i]!.html }} />
                    </span>
                  )}
                  {line.note && (
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
                      {renderText(line.note)}
                    </span>
                  )}
                </motion.div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
        {revealed > 1 && (
          <button type="button" onClick={() => setRevealed((r) => Math.max(1, r - 1))} style={stepBtn(false)}>Back</button>
        )}
        {!atEnd ? (
          <button type="button" onClick={() => setRevealed((r) => Math.min(lines.length, r + 1))} style={stepBtn(true)}>
            Next step <ArrowRight size={15} strokeWidth={2.3} />
          </button>
        ) : (
          <button type="button" onClick={() => setRevealed(1)} style={stepBtn(false)}>
            <RotateCcw size={14} strokeWidth={2.2} /> Replay
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-code)', fontFeatureSettings: '"tnum" 1', fontSize: '0.78rem', color: 'var(--ink-faint)' }}>
          {revealed} / {lines.length}
        </span>
      </div>

      {caption && (
        <figcaption style={{ marginTop: 'var(--space-3)', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--ink-faint)', textAlign: 'center' }}>
          {renderText(caption)}
        </figcaption>
      )}
    </figure>
  )
}

function stepBtn(primary: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 16px',
    fontFamily: 'var(--font-ui)', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius-2)',
    color: primary ? 'var(--paper-bg)' : 'var(--ink-secondary)',
    background: primary ? 'var(--accent)' : 'transparent',
    border: primary ? 'none' : 'var(--hairline)',
  }
}
