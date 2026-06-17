import type { MarginAnnotationBlock as MarginAnnotationBlockType } from '@/types'
import { renderText } from '@/lib/render-text'

export default function MarginAnnotationBlock({ text, author }: MarginAnnotationBlockType) {
  return (
    <aside
      style={{
        marginLeft: 'auto',
        maxWidth: '240px',
        marginTop: 'var(--space-2)',
        marginBottom: 'var(--space-2)',
        // Crisp 2px accent left rule + faint tint — no rough box, no rotation
        borderLeft: '2px solid var(--accent)',
        backgroundColor: 'color-mix(in srgb, var(--accent) 6%, var(--paper-bg))',
        borderRadius: '0 var(--radius-2) var(--radius-2) 0',
        padding: 'var(--space-3) var(--space-4)',
      }}
    >
      <div
        style={{
          // Handwriting stays — this is the ONE sanctioned place for it
          fontFamily: 'var(--font-handwritten)',
          fontSize: '1rem',
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
            fontSize: '0.875rem',
            color: 'var(--ink-faint)',
            marginTop: 'var(--space-2)',
            fontStyle: 'italic',
          }}
        >
          &mdash; {author}
        </div>
      )}
    </aside>
  )
}
