import { useRef, useEffect } from 'react'
import type { TimelineBlock as TimelineBlockType } from '@/types'
import { renderText } from '@/lib/render-text'
import rough from 'roughjs'

/** Rough.js circle dot for each timeline node */
function TimelineDot({ seed }: { seed: number }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    while (svg.firstChild) {
      svg.removeChild(svg.firstChild)
    }

    const rc = rough.svg(svg)
    const node = rc.circle(7, 7, 12, {
      seed,
      stroke: 'var(--chrome-accent, #52FEFE)',
      strokeWidth: 1.5,
      fill: 'var(--chrome-accent, #52FEFE)',
      fillStyle: 'solid',
      roughness: 1.2,
    })
    svg.appendChild(node)
  }, [seed])

  return (
    <svg
      ref={svgRef}
      width={14}
      height={14}
      style={{
        position: 'absolute',
        left: '-1.6rem',
        top: '0.4rem',
        overflow: 'visible',
      }}
    />
  )
}

export default function TimelineBlock({ events }: TimelineBlockType) {
  if (!events || events.length === 0) return null

  return (
    <div className="timeline">
      {events.map((event, i) => (
        <div key={i} className="timeline-node">
          <TimelineDot seed={i * 11 + 3} />

          <div className="timeline-content">
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--ink-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {event.icon && <span>{event.icon}</span>}
              <span>{renderText(event.title)}</span>
            </div>

            {event.description && (
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.9375rem',
                  lineHeight: 1.7,
                  color: 'var(--ink-secondary)',
                  marginTop: '0.25rem',
                }}
              >
                {renderText(event.description)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
