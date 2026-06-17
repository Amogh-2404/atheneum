import type { TableBlock as TableBlockType } from '@/types'
import { renderText } from '@/lib/render-text'

export default function TableBlock({ headers, rows, caption }: TableBlockType) {
  return (
    <figure
      style={{
        margin: 'var(--space-6) 0',
      }}
    >
      {/* Horizontal-scroll wrapper keeps wide tables from overflowing < 360px */}
      <div
        style={{
          width: '100%',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          borderRadius: 'var(--radius-2)',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'var(--font-body)',
            fontSize: '0.9375rem',
            lineHeight: 1.5,
            color: 'var(--ink-primary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {headers && headers.length > 0 && (
            <thead>
              <tr>
                {headers.map((header, i) => (
                  <th
                    key={i}
                    scope="col"
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      textAlign: 'left',
                      color: 'var(--ink-secondary)',
                      padding: 'var(--space-3) var(--space-4)',
                      borderBottom: '2px solid var(--ink-secondary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {renderText(header)}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {(rows ?? []).map((row, i) => (
              <tr
                key={i}
                style={{
                  // Zebra via a 3% ink tint, not a 'pencil-smudge' texture
                  backgroundColor:
                    i % 2 === 1
                      ? 'color-mix(in srgb, var(--ink-primary) 3%, var(--paper-bg))'
                      : 'transparent',
                }}
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      borderBottom: 'var(--hairline)',
                      verticalAlign: 'top',
                    }}
                  >
                    {renderText(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
