import { useState } from 'react'
import type { FigureBlock as FigureBlockType } from '@/types'
import { renderText } from '@/lib/render-text'

export default function FigureBlock({ src, alt, caption, layout, width }: FigureBlockType) {
  const [hasError, setHasError] = useState(false)

  const layoutClass =
    layout === 'left'
      ? 'figure-left'
      : layout === 'right'
        ? 'figure-right'
        : layout === 'full'
          ? 'figure-full'
          : 'figure-center'

  return (
    <figure className={`my-6 ${layoutClass}`} style={width ? { width } : undefined}>
      {hasError ? (
        <div
          style={{
            minHeight: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px dashed var(--ink-faint)',
            borderRadius: '8px',
            backgroundColor: 'var(--paper-bg)',
            padding: '1.5rem',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-handwritten)',
              fontSize: '0.95rem',
              color: 'var(--ink-faint)',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            {alt || 'Image placeholder'}
          </span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt ?? ''}
          style={{ maxWidth: '100%', display: 'block' }}
          onError={() => setHasError(true)}
          loading="lazy"
        />
      )}
      {caption && (
        <figcaption className="figure-caption">
          {renderText(caption)}
        </figcaption>
      )}
    </figure>
  )
}
