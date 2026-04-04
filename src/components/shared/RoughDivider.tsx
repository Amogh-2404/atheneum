import { useRef, useEffect, useState } from 'react'
import rough from 'roughjs'

interface RoughDividerProps {
  style?: 'line' | 'dots' | 'wave' | 'flourish'
  seed?: number
  stroke?: string
  strokeWidth?: number
  className?: string
}

export default function RoughDivider({
  style = 'line',
  seed = 7,
  stroke = '#9a9a9a',
  strokeWidth = 1,
  className = '',
}: RoughDividerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || width <= 0) return

    while (svg.firstChild) {
      svg.removeChild(svg.firstChild)
    }

    const rc = rough.svg(svg)
    const opts = { seed, stroke, strokeWidth, roughness: 1.5 }

    switch (style) {
      case 'line': {
        const node = rc.line(0, 15, width, 15, opts)
        svg.appendChild(node)
        break
      }

      case 'dots': {
        const cx = width / 2
        const spacing = 20
        for (let i = -1; i <= 1; i++) {
          const node = rc.circle(cx + i * spacing, 15, 6, {
            ...opts,
            fill: stroke,
            fillStyle: 'solid',
          })
          svg.appendChild(node)
        }
        break
      }

      case 'wave': {
        // Sine wave path across the width
        const amplitude = 6
        const frequency = 0.04
        let d = `M 0 15`
        for (let x = 1; x <= width; x += 4) {
          const y = 15 + amplitude * Math.sin(frequency * x)
          d += ` L ${x} ${y.toFixed(2)}`
        }
        const node = rc.path(d, { ...opts, roughness: 0.8 })
        svg.appendChild(node)
        break
      }

      case 'flourish': {
        // Decorative curl centered
        const cx = width / 2
        const d = `M ${cx - 60} 15 C ${cx - 30} 0, ${cx - 15} 30, ${cx} 15 S ${cx + 30} 0, ${cx + 60} 15`
        const node = rc.path(d, { ...opts, roughness: 1.0 })
        svg.appendChild(node)
        break
      }
    }
  }, [width, style, seed, stroke, strokeWidth])

  return (
    <div
      ref={containerRef}
      className={`rough-divider ${className}`}
      style={{ margin: '2rem 0' }}
    >
      <svg
        ref={svgRef}
        width={width || '100%'}
        height={30}
        style={{ display: 'block', overflow: 'visible' }}
      />
    </div>
  )
}
