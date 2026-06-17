import type { QuoteBlock as QuoteBlockType } from '@/types'
import { renderText } from '@/lib/render-text'

export default function QuoteBlock({ text, attribution, source }: QuoteBlockType) {
  return (
    <figure
      className="codex-quote"
      style={{
        margin: 'var(--space-4) 0',
        paddingLeft: 'var(--space-5)',
        borderLeft: '3px solid var(--accent)',
      }}
    >
      <blockquote
        style={{
          margin: 0,
          fontFamily: 'var(--font-body)',
          fontStyle: 'italic',
          fontSize: '1.0625rem',
          lineHeight: 1.7,
          color: 'var(--ink-primary)',
        }}
      >
        {renderText(text)}
      </blockquote>

      {(attribution ?? source) && (
        <figcaption
          style={{
            marginTop: 'var(--space-2)',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.875rem',
            fontStyle: 'normal',
            color: 'var(--ink-faint)',
          }}
        >
          {attribution && <span>&mdash; {attribution}</span>}
          {source && (
            <cite style={{ marginLeft: attribution ? '0.25rem' : 0, fontStyle: 'italic' }}>
              {attribution ? `, ${source}` : source}
            </cite>
          )}
        </figcaption>
      )}
    </figure>
  )
}
