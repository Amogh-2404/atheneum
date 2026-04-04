import { useMemo } from 'react'
import type { MathBlock as MathBlockType } from '@/types'
import 'katex/dist/katex.min.css'
import katex from 'katex'

export default function MathBlock({ expression, display }: MathBlockType) {
  const rendered = useMemo(() => {
    if (!expression) return { html: '', error: false }

    try {
      const html = katex.renderToString(expression, {
        displayMode: display !== false,
        throwOnError: true,
        trust: false,
      })
      return { html, error: false }
    } catch {
      return { html: '', error: true }
    }
  }, [expression, display])

  // Error fallback: show raw expression
  if (rendered.error) {
    return display === false ? (
      <span className="math-error" style={{ display: 'inline' }}>
        {expression ?? ''}
      </span>
    ) : (
      <div style={{ margin: '1.5rem 0', display: 'flex', justifyContent: 'center' }}>
        <span className="math-error">{expression ?? ''}</span>
      </div>
    )
  }

  // Inline math
  if (display === false) {
    return (
      <span
        className="math-inline"
        dangerouslySetInnerHTML={{ __html: rendered.html }}
      />
    )
  }

  // Display (block) math
  return (
    <div className="math-display">
      <div dangerouslySetInnerHTML={{ __html: rendered.html }} />
    </div>
  )
}
