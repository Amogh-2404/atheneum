import { useRef, useEffect } from 'react'
import rough from 'roughjs'

interface RoughUnderlineProps {
  width: number
  seed?: number
  stroke?: string
  strokeWidth?: number
  roughness?: number
  className?: string
}

export default function RoughUnderline({
  width,
  seed = 1,
  stroke = '#2c2c2c',
  strokeWidth = 1.5,
  roughness = 1.5,
  className = '',
}: RoughUnderlineProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || width <= 0) return

    while (svg.firstChild) {
      svg.removeChild(svg.firstChild)
    }

    const rc = rough.svg(svg)
    const y = 6 // vertical center of the SVG
    const node = rc.line(0, y, width, y, {
      seed,
      stroke,
      strokeWidth,
      roughness,
    })
    svg.appendChild(node)
  }, [width, seed, stroke, strokeWidth, roughness])

  if (width <= 0) return null

  return (
    <svg
      ref={svgRef}
      width={width}
      height={12}
      className={className}
      style={{ display: 'block', overflow: 'visible' }}
    />
  )
}
