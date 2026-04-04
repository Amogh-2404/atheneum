import type { MarginAnnotationBlock as MarginAnnotationBlockType } from '@/types'
import { renderText } from '@/lib/render-text'
import RoughBox from '@/components/shared/RoughBox'

export default function MarginAnnotationBlock({ text, author }: MarginAnnotationBlockType) {
  return (
    <aside
      style={{
        marginLeft: 'auto',
        maxWidth: '220px',
        transform: 'rotate(1.2deg)',
        marginTop: '0.5rem',
        marginBottom: '0.5rem',
      }}
    >
      <RoughBox
        seed={77}
        stroke="var(--ink-faint)"
        strokeWidth={1}
        fill="rgba(254, 243, 199, 0.5)"
        fillStyle="solid"
        roughness={1.5}
        padding="0.75rem 1rem"
      >
        <div
          style={{
            fontFamily: 'var(--font-handwritten)',
            fontSize: '0.9375rem',
            lineHeight: 1.5,
            color: 'var(--ink-secondary)',
          }}
        >
          {renderText(text)}
        </div>
        {author && (
          <div
            style={{
              fontFamily: 'var(--font-handwritten)',
              fontSize: '0.8125rem',
              color: 'var(--ink-faint)',
              marginTop: '0.375rem',
              fontStyle: 'italic',
            }}
          >
            &mdash; {author}
          </div>
        )}
      </RoughBox>
    </aside>
  )
}
