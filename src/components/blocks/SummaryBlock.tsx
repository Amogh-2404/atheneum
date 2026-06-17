import type { SummaryBlock as SummaryBlockType } from '@/types'
import { renderText } from '@/lib/render-text'
import { Check } from 'lucide-react'

export default function SummaryBlock({ points }: SummaryBlockType) {
  if (!points || points.length === 0) return null

  return (
    <div className="summary-block" style={{ margin: 'var(--space-5) 0' }}>
      <div
        style={{
          border: 'var(--hairline)',
          borderRadius: 'var(--radius-3)',
          padding: 'var(--space-5) var(--space-5)',
          background: 'color-mix(in srgb, var(--ink-faint) 4%, var(--paper-bg))',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            marginBottom: 'var(--space-3)',
          }}
        >
          Summary
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {points.map((point, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-2)',
                fontFamily: 'var(--font-body)',
                fontSize: '1rem',
                lineHeight: 1.7,
                color: 'var(--ink-primary)',
              }}
            >
              <Check
                size={16}
                strokeWidth={2.5}
                aria-hidden="true"
                style={{
                  flexShrink: 0,
                  color: 'var(--accent)',
                  marginTop: '0.35rem',
                }}
              />
              <span>{renderText(point)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
