import { useRef, useEffect, useState } from 'react'
import rough from 'roughjs'

interface RoughBoxProps {
  children: React.ReactNode
  seed?: number
  stroke?: string
  strokeWidth?: number
  fill?: string
  fillStyle?: 'hachure' | 'solid' | 'zigzag' | 'cross-hatch' | 'dots'
  roughness?: number
  padding?: string
  className?: string
}

export default function RoughBox({
  children,
  seed = 42,
  stroke = '#2c2c2c',
  strokeWidth = 1.5,
  fill,
  fillStyle = 'hachure',
  roughness = 1.2,
  padding = '1rem',
  className = '',
}: RoughBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  // Observe container size changes
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setSize({ width, height })
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Draw the rough rectangle when size changes
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || size.width === 0 || size.height === 0) return

    // Clear previous drawings
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild)
    }

    const rc = rough.svg(svg)
    const margin = 2 // small inset so strokes don't clip
    const node = rc.rectangle(
      margin,
      margin,
      size.width - margin * 2,
      size.height - margin * 2,
      {
        seed,
        stroke,
        strokeWidth,
        fill: fill || undefined,
        fillStyle: fill ? fillStyle : undefined,
        roughness,
      }
    )
    svg.appendChild(node)
  }, [size, seed, stroke, strokeWidth, fill, fillStyle, roughness])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative' }}
    >
      <svg
        ref={svgRef}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div style={{ position: 'relative', zIndex: 1, padding }}>
        {children}
      </div>
    </div>
  )
}
