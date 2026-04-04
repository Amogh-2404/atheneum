import type { TableBlock as TableBlockType } from '@/types'
import { renderText } from '@/lib/render-text'

export default function TableBlock({ headers, rows, caption }: TableBlockType) {
  return (
    <figure className="notebook-table-wrap">
      <table className="notebook-table">
        {headers && headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((header, i) => (
                <th key={i}>
                  {renderText(header)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {(rows ?? []).map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>
                  {renderText(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {caption && (
        <figcaption className="notebook-table-caption">
          {renderText(caption)}
        </figcaption>
      )}
    </figure>
  )
}
