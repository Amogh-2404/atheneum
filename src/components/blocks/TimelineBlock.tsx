import type { TimelineBlock as TimelineBlockType } from '@/types'
import { renderText } from '@/lib/render-text'

export default function TimelineBlock({ events }: TimelineBlockType) {
  if (!events || events.length === 0) return null

  return (
    <ol
      className="timeline"
      style={{
        listStyle: 'none',
        position: 'relative',
        margin: 'var(--space-6) 0',
        padding: 0,
        // The spine: a single hairline running the full height, left of content.
        paddingLeft: 'var(--space-6)',
      }}
    >
      {/* Vertical hairline spine (one element, not per-item SVG) */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '4px',
          top: '0.55rem',
          bottom: '0.55rem',
          width: '1px',
          background: 'var(--hairline-color)',
        }}
      />

      {events.map((event, i) => (
        <li
          key={i}
          className="timeline-node"
          style={{
            position: 'relative',
            paddingBottom: i === events.length - 1 ? 0 : 'var(--space-5)',
          }}
        >
          {/* Solid accent dot, pure CSS, anchored on the spine */}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 'calc(-1 * var(--space-6) + 1px)',
              top: '0.5rem',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--accent)',
              boxShadow: '0 0 0 3px var(--paper-bg)',
            }}
          />

          <div className="timeline-content">
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.0625rem',
                fontWeight: 600,
                lineHeight: 1.35,
                color: 'var(--ink-primary)',
              }}
            >
              {renderText(event.title)}
            </div>

            {event.description && (
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.9375rem',
                  lineHeight: 1.7,
                  color: 'var(--ink-secondary)',
                  marginTop: 'var(--space-1)',
                }}
              >
                {renderText(event.description)}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
