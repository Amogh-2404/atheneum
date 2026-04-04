import type { SummaryBlock as SummaryBlockType } from '@/types'
import { renderText } from '@/lib/render-text'
import RoughBox from '@/components/shared/RoughBox'

export default function SummaryBlock({ points }: SummaryBlockType) {
  if (!points || points.length === 0) return null

  return (
    <div style={{ margin: '1.5rem 0' }}>
      <RoughBox
        seed={99}
        stroke="var(--ink-primary)"
        strokeWidth={1.5}
        fill="rgba(254, 243, 199, 0.15)"
        fillStyle="hachure"
        roughness={1.0}
        padding="1.25rem 1.5rem"
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
              <span style={{ color: 'var(--chrome-accent, #52FEFE)', marginTop: '0.1rem' }}>
                &bull;
              </span>
              <span>{renderText(point)}</span>
            </li>
          ))}
        </ul>
      </RoughBox>
    </div>
  )
}
