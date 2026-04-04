import { useRef, useEffect } from 'react'
import type { ListBlock as ListBlockType, ListItem } from '@/types'
import { renderText } from '@/lib/render-text'
import rough from 'roughjs'

/** A small rough circle bullet for unordered list items */
function RoughBullet({ seed }: { seed: number }) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    while (svg.firstChild) {
      svg.removeChild(svg.firstChild)
    }

    const rc = rough.svg(svg)
    const node = rc.circle(6, 6, 7, {
      seed,
      stroke: 'var(--ink-faint)',
      strokeWidth: 1.2,
      fill: 'var(--ink-faint)',
      fillStyle: 'solid',
      roughness: 1.5,
    })
    svg.appendChild(node)
  }, [seed])

  return (
    <svg
      ref={svgRef}
      width={12}
      height={12}
      style={{
        flexShrink: 0,
        /* Center vertically within the 2rem line-height */
        marginTop: '0.55rem',
        overflow: 'visible',
      }}
    />
  )
}

function ListItemNode({
  item,
  index,
  ordered,
  depth,
}: {
  item: ListItem
  index: number
  ordered: boolean
  depth: number
}) {
  return (
    <li
      className="notebook-list-item"
      style={{
        listStyle: 'none',
        paddingLeft: depth > 0 ? '1.25rem' : undefined,
      }}
    >
      {ordered ? (
        <span
          style={{
            fontFamily: 'var(--font-heading)', /* Caveat — handwritten numbers */
            fontSize: '1.25rem',
            color: 'var(--ink-secondary)',
            minWidth: '1.5rem',
            lineHeight: '2rem',
            flexShrink: 0,
            fontWeight: 700,
          }}
        >
          {index + 1}.
        </span>
      ) : (
        <RoughBullet seed={index * 7 + depth * 31 + 5} />
      )}
      <span className="notebook-text" style={{ margin: 0, lineHeight: '2rem' }}>
        {renderText(item.text)}
      </span>
      {item.children && item.children.length > 0 && (
        <ul style={{ listStyle: 'none', paddingLeft: 0, marginTop: 0 }}>
          {item.children.map((child, i) => (
            <ListItemNode
              key={i}
              item={child}
              index={i}
              ordered={ordered}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export default function ListBlock({ style, items }: ListBlockType) {
  const Tag = style === 'ordered' ? 'ol' : 'ul'

  return (
    <Tag
      className={`notebook-list${style === 'ordered' ? ' notebook-list-ordered' : ''}`}
      style={{ listStyle: 'none', paddingLeft: 0, margin: '0 0 2rem 0' }}
    >
      {(items ?? []).map((item, i) => (
        <ListItemNode
          key={i}
          item={item}
          index={i}
          ordered={style === 'ordered'}
          depth={0}
        />
      ))}
    </Tag>
  )
}
