import { useReducedMotion } from 'framer-motion'
import { renderText } from '@/lib/render-text'
import { useActiveStep } from '@/hooks/useActiveStep'
import type { ScrollyFigureBlock as ScrollyFigureBlockType, ScrollyStage } from '@/types'

/**
 * Scrollytelling: a graphic PINS (position:sticky on the compositor — can't desync
 * from an iOS fling) while its stages cross-fade and the step captions scroll past.
 * The active step comes from useActiveStep (one IntersectionObserver, no scroll
 * listeners). Frame height is 100svh (NOT dvh — dvh re-lays-out every frame as the
 * iOS URL bar animates) with a -webkit-fill-available fallback. Reduced-motion /
 * no-JS → a plain stacked StaticFallback.
 */
export default function ScrollyFigureBlock(props: ScrollyFigureBlockType & { bookId?: string; chapterId?: string }) {
  const { stages, steps, aspect, sticky, caption } = props
  const reduce = useReducedMotion()
  const { active, setStepRef } = useActiveStep(steps.length)
  const activeStage = steps[active]?.stage ?? 0

  if (reduce) return <StaticFallback stages={stages} steps={steps} aspect={aspect} caption={caption} />

  return (
    <figure className="scrolly-figure not-prose" style={{ position: 'relative', margin: 'var(--space-7) 0' }}>
      <div
        className="cinematic-bleed"
        style={{
          position: 'sticky', top: 0, height: '100svh', minHeight: '-webkit-fill-available',
          display: 'flex', alignItems: sticky === 'top' ? 'flex-start' : 'center', justifyContent: 'center',
          overflow: 'clip', pointerEvents: 'none', padding: 'var(--space-6) var(--space-4)',
        }}
      >
        <div style={{ position: 'relative', width: '100%', maxWidth: 560, aspectRatio: aspect || '4 / 3' }}>
          {stages.map((s, i) => <StageLayer key={i} stage={s} active={i === activeStage} near={Math.abs(i - activeStage) <= 1} />)}
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: '-100svh', pointerEvents: 'none' }}>
        {steps.map((step, i) => (
          <div key={i} ref={setStepRef(i)} style={{ minHeight: '85svh', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '11svh' }}>
            <div
              className="scrolly-cap"
              style={{
                pointerEvents: 'auto', maxWidth: '34ch', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-2)',
                background: 'var(--chrome-glass)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
                border: '1px solid var(--chrome-border)', boxShadow: 'var(--shadow-3)',
                fontFamily: 'var(--font-body)', fontSize: '1.02rem', lineHeight: 1.55, color: 'var(--chrome-hover-text)',
                opacity: i === active ? 1 : 0.45, transform: i === active ? 'translateY(0)' : 'translateY(4px)',
                transition: 'opacity 300ms ease, transform 300ms ease',
              }}
            >
              {renderText(step.caption)}
            </div>
          </div>
        ))}
      </div>

      {caption && (
        <figcaption style={{ textAlign: 'center', marginTop: 'var(--space-2)', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--ink-faint)' }}>
          {renderText(caption)}
        </figcaption>
      )}
    </figure>
  )
}

function StageLayer({ stage, active, near }: { stage: ScrollyStage; active: boolean; near: boolean }) {
  const style: React.CSSProperties = {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: active ? 1 : 0,
    transform: active ? 'scale(1) translateY(0)' : 'scale(0.985) translateY(6px)',
    transition: 'opacity 520ms cubic-bezier(0,0,0.2,1), transform 600ms cubic-bezier(0,0,0.2,1)',
    willChange: near ? 'opacity, transform' : 'auto',
  }
  return (
    <div style={style}>
      {stage.kind === 'image' && stage.src
        ? <img src={stage.src} alt={stage.alt || ''} loading="lazy" decoding="async" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        : <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.85rem', color: 'var(--ink-faint)' }}>{stage.alt || ''}</span>}
    </div>
  )
}

// Reduced-motion / no-JS: every stage and caption, stacked and fully visible.
function StaticFallback({ stages, steps, aspect, caption }: { stages: ScrollyStage[]; steps: ScrollyFigureBlockType['steps']; aspect?: string; caption?: ScrollyFigureBlockType['caption'] }) {
  return (
    <figure className="scrolly-figure not-prose" style={{ margin: 'var(--space-7) 0' }}>
      {steps.map((step, i) => {
        const stage = stages[step.stage]
        return (
          <div key={i} style={{ marginBottom: 'var(--space-5)' }}>
            <div className="cinematic-bleed" style={{ position: 'relative', width: '100%', maxWidth: 560, margin: '0 auto', aspectRatio: aspect || '4 / 3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {stage?.kind === 'image' && stage.src && <img src={stage.src} alt={stage.alt || ''} loading="lazy" decoding="async" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
            </div>
            <div style={{ maxWidth: '34ch', margin: 'var(--space-3) auto 0', fontFamily: 'var(--font-body)', fontSize: '1rem', lineHeight: 1.55, color: 'var(--ink-primary)', textAlign: 'center' }}>
              {renderText(step.caption)}
            </div>
          </div>
        )
      })}
      {caption && <figcaption style={{ textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--ink-faint)' }}>{renderText(caption)}</figcaption>}
    </figure>
  )
}
