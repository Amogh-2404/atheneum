import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import type { ReactiveMathBlock as ReactiveMathBlockType } from '@/types'
import { resolveScope, substituteTemplate, formatNumber } from '@/lib/reactive-eval'
import { renderText } from '@/lib/render-text'
import 'katex/dist/katex.min.css'
import katex from 'katex'

/**
 * A formula you can feel. Drag a parameter slider and watch the LaTeX recompute
 * live. The expression engine is a sandboxed arithmetic evaluator (NO eval), so a
 * reactive block is safe to ship as content. Bret Victor's reactive document,
 * authored by the AI instead of a programmer-per-essay.
 */
export default function ReactiveMathBlock({
  params,
  derived,
  template,
  caption,
  precision = 4,
}: ReactiveMathBlockType) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries((params ?? []).map((p) => [p.name, p.default]))
  )

  // rAF-throttle: accumulate slider moves in a ref, flush to state once per frame
  // so dragging never queues more than one KaTeX re-render per paint. No animation.
  const valuesRef = useRef(values)
  valuesRef.current = values
  const rafRef = useRef<number | null>(null)
  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current) }, [])

  const setParam = useCallback((name: string, v: number) => {
    valuesRef.current = { ...valuesRef.current, [name]: v }
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        setValues(valuesRef.current)
      })
    }
  }, [])

  const { scope, error: evalError } = useMemo(
    () => resolveScope(values, derived),
    [values, derived]
  )

  const rendered = useMemo(() => {
    const latex = substituteTemplate(template ?? '', scope, precision)
    try {
      return {
        html: katex.renderToString(latex, {
          displayMode: true,
          throwOnError: true,
          trust: false,
        }),
        error: false,
      }
    } catch {
      return { html: '', error: true }
    }
  }, [template, scope, precision])

  return (
    <div
      className="reactive-math"
      style={{
        margin: 'var(--leading, 2rem) 0',
        border: '1px solid var(--ruled-line-color, rgba(140,160,200,0.25))',
        borderRadius: 8,
        background: 'color-mix(in srgb, var(--paper-bg) 92%, var(--chrome-accent) 8%)',
        overflow: 'hidden',
      }}
    >
      {/* Eyebrow — same grammar as the Predict block */}
      <div
        style={{
          padding: '0.7rem 1.5rem 0',
          fontFamily: 'var(--font-ui)',
          fontSize: '0.62rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--chrome-accent, #52FEFE)',
        }}
      >
        Interactive · drag to explore
      </div>

      {/* Live formula */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          overflowX: 'auto',
          borderBottom: '1px solid var(--ruled-line-color, rgba(140,160,200,0.2))',
        }}
      >
        {rendered.error ? (
          <span className="math-error">[reactive formula error]</span>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: rendered.html }} />
        )}
      </div>

      {/* Sliders */}
      <div style={{ padding: '0.9rem 1.5rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(params ?? []).map((p) => {
          const v = values[p.name] ?? p.default
          const step = p.step ?? ((p.max - p.min) / 100 || 1)
          const pct = p.max > p.min ? ((v - p.min) / (p.max - p.min)) * 100 : 0
          return (
            <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <label
                htmlFor={`rm-${p.name}`}
                title={p.label ?? p.name}
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                  color: 'var(--ink-secondary)',
                  maxWidth: 92,
                  flexShrink: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {p.label ?? p.name}
              </label>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <input
                  id={`rm-${p.name}`}
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={step}
                  value={v}
                  onChange={(e) => setParam(p.name, parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: 'var(--chrome-accent, #52FEFE)',
                    height: 4,
                    cursor: 'pointer',
                    background: `linear-gradient(to right, var(--chrome-accent, #52FEFE) ${pct}%, var(--ruled-line-color, rgba(140,160,200,0.3)) ${pct}%)`,
                    borderRadius: 2,
                    appearance: 'none',
                    WebkitAppearance: 'none',
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontFamily: 'var(--font-code)',
                    fontSize: '0.68rem',
                    color: 'var(--ink-faint)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span>{formatNumber(p.min, precision)}</span>
                  <span>{formatNumber(p.max, precision)}</span>
                </div>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-code)',
                  fontSize: '0.82rem',
                  color: 'var(--ink-primary)',
                  minWidth: 56,
                  textAlign: 'right',
                  flexShrink: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatNumber(v, precision)}
              </span>
            </div>
          )
        })}
        {evalError && (
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.72rem',
              color: 'var(--color-error, #f87171)',
            }}
          >
            {evalError}
          </div>
        )}
      </div>

      {caption && (
        <div
          style={{
            padding: '0 1.5rem 1rem',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.8rem',
            color: 'var(--ink-secondary)',
            lineHeight: 1.5,
          }}
        >
          {renderText(caption)}
        </div>
      )}
    </div>
  )
}
