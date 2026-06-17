import type { HeadingBlock as HeadingBlockType } from '@/types'
import { renderText } from '@/lib/render-text'

interface HeadingBlockProps extends HeadingBlockType {
  /** True if this is the first h1 in the chapter — gets a special chapter-start vibe */
  isChapterStart?: boolean
}

const displayFeel: React.CSSProperties = {
  fontFamily: 'var(--font-heading)',
  color: 'var(--ink-primary)',
  // Fraunces optical sizing — opens up the display feel without a separate face
  fontVariationSettings: "'opsz' 40",
  letterSpacing: '-0.01em',
  textWrap: 'balance',
}

export default function HeadingBlock({
  level,
  text,
  anchor,
  isChapterStart,
}: HeadingBlockProps) {
  const id = anchor ?? undefined
  const content = renderText(text)
  const headingId = anchor ?? id

  switch (level) {
    case 1:
      return (
        <h1
          id={id}
          data-heading-id={headingId}
          style={{
            ...displayFeel,
            fontWeight: 700,
            fontSize: isChapterStart ? '3rem' : '2.25rem',
            lineHeight: 1.1,
            marginTop: isChapterStart ? 'var(--space-4)' : 'var(--space-7)',
            marginBottom: 'var(--space-4)',
          }}
        >
          {content}
        </h1>
      )
    case 2:
      return (
        <h2
          id={id}
          data-heading-id={headingId}
          style={{
            ...displayFeel,
            fontWeight: 600,
            fontSize: '1.625rem',
            lineHeight: 1.2,
            marginTop: 'var(--space-6)',
            marginBottom: 'var(--space-3)',
            // Optional static 2px accent bottom-rule — crisp, no wobble
            paddingBottom: 'var(--space-2)',
            borderBottom: '2px solid var(--accent)',
          }}
        >
          {content}
        </h2>
      )
    case 3:
    default:
      return (
        <h3
          id={id}
          data-heading-id={headingId}
          style={{
            ...displayFeel,
            fontWeight: 600,
            fontSize: '1.25rem',
            lineHeight: 1.25,
            marginTop: 'var(--space-5)',
            marginBottom: 'var(--space-2)',
          }}
        >
          {content}
        </h3>
      )
  }
}
