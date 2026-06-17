import type { SummaryBlock as SummaryBlockType } from '@/types'
import { renderText } from '@/lib/render-text'

export default function SummaryBlock({ points }: SummaryBlockType) {
  if (!points || points.length === 0) return null

  return (
    <div className="summary-block" style={{ margin: '1.5rem 0' }}>
      <div
        style={{
          border: '1.5px solid var(--ink-primary)',
          borderRadius: '8px',
          padding: '1.25rem 1.5rem',
          background: 'rgba(254, 243, 199, 0.08)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-handwritten)',
            fontSize: '1.25rem',
            color: 'var(--ink-primary)',
            marginBottom: '0.75rem',
          }}
        >
          Key Takeaways
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {points.map((point, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                marginBottom: '0.375rem',
                fontFamily: 'var(--font-body)',
                fontSize: '1rem',
                lineHeight: 1.7,
                color: 'var(--ink-primary)',
              }}
            >
              <span style={{ color: 'var(--chrome-accent, var(--chrome-accent))', marginTop: '0.1rem' }}>
                &bull;
              </span>
              <span>{renderText(point)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
