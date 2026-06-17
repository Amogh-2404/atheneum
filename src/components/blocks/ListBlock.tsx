import type { ListBlock as ListBlockType, ListItem } from '@/types'
import { renderText } from '@/lib/render-text'

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
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        paddingLeft: depth > 0 ? 'var(--space-5)' : undefined,
      }}
    >
      {ordered ? (
        <span
          aria-hidden="true"
          style={{
            fontFamily: 'var(--font-ui)',
            fontVariantNumeric: 'tabular-nums',
            fontSize: '0.9375rem',
            fontWeight: 600,
            color: 'var(--accent)',
            minWidth: '1.5rem',
            textAlign: 'right',
            lineHeight: '2rem',
            flexShrink: 0,
          }}
        >
          {index + 1}.
        </span>
      ) : (
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            background: 'var(--ink-faint)',
            /* center the dot on the 2rem line-height cap height */
            marginTop: '0.72rem',
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span className="notebook-text" style={{ margin: 0, lineHeight: '2rem' }}>
          {renderText(item.text)}
        </span>
        {item.children && item.children.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0 0', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
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
      </div>
    </li>
  )
}

export default function ListBlock({ style, items }: ListBlockType) {
  const Tag = style === 'ordered' ? 'ol' : 'ul'

  return (
    <Tag
      className={`notebook-list${style === 'ordered' ? ' notebook-list-ordered' : ''}`}
      style={{
        listStyle: 'none',
        padding: 0,
        margin: '0 0 var(--space-6) 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
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
