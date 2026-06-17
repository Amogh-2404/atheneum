import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import type { FigureBlock as FigureBlockType } from '@/types'
import { renderText } from '@/lib/render-text'

export default function FigureBlock({ src, alt, caption, layout, width }: FigureBlockType) {
  const [hasError, setHasError] = useState(false)

  // Layout → alignment / float, tokenized. No rotation, tape, washi, or caret.
  const layoutStyle: React.CSSProperties =
    layout === 'left'
      ? { float: 'left', marginRight: 'var(--space-5)', maxWidth: 'min(50%, 320px)' }
      : layout === 'right'
        ? { float: 'right', marginLeft: 'var(--space-5)', maxWidth: 'min(50%, 320px)' }
        : layout === 'full'
          ? { width: '100%' }
          : { marginLeft: 'auto', marginRight: 'auto', maxWidth: '100%' }

  return (
    <figure
      style={{
        marginTop: 'var(--space-6)',
        marginBottom: 'var(--space-6)',
        ...layoutStyle,
        ...(width ? { width } : null),
      }}
    >
      {hasError ? (
        <div
          style={{
            minHeight: '120px',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'var(--hairline)',
            borderRadius: 'var(--radius-2)',
            backgroundColor: 'var(--paper-bg)',
            padding: 'var(--space-5)',
          }}
        >
          <ImageOff size={20} strokeWidth={1.5} color="var(--ink-faint)" aria-hidden="true" />
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.875rem',
              color: 'var(--ink-faint)',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            {alt || 'Image unavailable'}
          </span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt ?? ''}
          style={{
            maxWidth: '100%',
            display: 'block',
            margin: layout === 'center' || !layout ? '0 auto' : undefined,
            borderRadius: 'var(--radius-2)',
            border: 'var(--hairline)',
          }}
          onError={() => setHasError(true)}
          loading="lazy"
        />
      )}
      {caption && (
        <figcaption
          style={{
            marginTop: 'var(--space-3)',
            fontFamily: 'var(--font-body)',
            fontStyle: 'italic',
            fontSize: '0.875rem',
            lineHeight: 1.55,
            color: 'var(--ink-secondary)',
            textAlign: 'center',
          }}
        >
          {renderText(caption)}
        </figcaption>
      )}
    </figure>
  )
}
