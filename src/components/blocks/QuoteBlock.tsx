import { useRef, useEffect, useState } from 'react'
import type { QuoteBlock as QuoteBlockType } from '@/types'
import { renderText } from '@/lib/render-text'
import rough from 'roughjs'

export default function QuoteBlock({ text, attribution, source }: QuoteBlockType) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  // Measure container height for the rough vertical line
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeight(entry.contentRect.height)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Draw the rough vertical line
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || height <= 0) return

    while (svg.firstChild) {
      svg.removeChild(svg.firstChild)
    }

    const rc = rough.svg(svg)
    const node = rc.line(4, 2, 4, height - 2, {
      seed: 23,
      stroke: 'var(--ink-faint)',
      strokeWidth: 2.5,
      roughness: 1.8,
    })
    svg.appendChild(node)
  }, [height])

  return (
    <div
      ref={containerRef}
      className="notebook-quote"
      style={{
        position: 'relative',
        borderLeft: 'none',
        paddingLeft: '1.75rem',
      }}
    >
      {/* Rough.js vertical line instead of CSS border */}
      <svg
        ref={svgRef}
        width={10}
        height={height || 1}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      />

      <p style={{ margin: 0, lineHeight: 1.7 }}>
        {renderText(text)}
      </p>

      {(attribution ?? source) && (
        <footer style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--ink-faint)', fontStyle: 'normal' }}>
          {attribution && <span>&mdash; {attribution}</span>}
          {source && (
            <span style={{ marginLeft: '0.25rem', fontStyle: 'italic' }}>
              {attribution ? `, ${source}` : source}
            </span>
          )}
        </footer>
      )}
    </div>
  )
}
