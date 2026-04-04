import { useRef, useState, useEffect } from 'react'
import type { HeadingBlock as HeadingBlockType } from '@/types'
import { renderText } from '@/lib/render-text'
import RoughUnderline from '@/components/shared/RoughUnderline'

interface HeadingBlockProps extends HeadingBlockType {
  /** True if this is the first h1 in the chapter — gets a special chapter-start vibe */
  isChapterStart?: boolean
}

export default function HeadingBlock({
  level,
  text,
  anchor,
  isChapterStart,
}: HeadingBlockProps) {
  const id = anchor ?? undefined
  const content = renderText(text)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [headingWidth, setHeadingWidth] = useState(0)

  // Measure heading width for the underline
  useEffect(() => {
    const el = headingRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeadingWidth(entry.contentRect.width)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Derive a seed from the anchor or text content for deterministic wobble
  const seed = typeof text === 'string'
    ? text.length * 7 + 3
    : Array.isArray(text) ? text.length * 7 + 3 : 42

  switch (level) {
    case 1:
      return (
        <div style={{ marginTop: isChapterStart ? '1rem' : '2rem', marginBottom: '0.75rem' }}>
          <h1
            ref={headingRef}
            id={id}
            data-heading-id={anchor ?? id}
            className={`notebook-h1${isChapterStart ? ' chapter-start' : ''}`}
            style={isChapterStart ? { fontSize: '3.25rem', marginTop: '1rem' } : undefined}
          >
            {content}
          </h1>
          <RoughUnderline
            width={Math.min(headingWidth, 500)}
            seed={seed}
            stroke="var(--ink-primary)"
            strokeWidth={2}
            roughness={1.8}
          />
        </div>
      )
    case 2:
      return (
        <div style={{ marginTop: '1.75rem', marginBottom: '0.5rem' }}>
          <h2 ref={headingRef} id={id} data-heading-id={anchor ?? id} className="notebook-h2">
            {content}
          </h2>
          <RoughUnderline
            width={Math.min(headingWidth, 350)}
            seed={seed + 1}
            stroke="var(--ink-faint)"
            strokeWidth={1.2}
            roughness={1.5}
          />
        </div>
      )
    case 3:
    default:
      return (
        <h3 id={id} data-heading-id={anchor ?? id} className="notebook-h3">
          {content}
        </h3>
      )
  }
}
