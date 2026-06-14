import type { ToggleBlock as ToggleBlockType } from '@/types'
import { renderText } from '@/lib/render-text'
// BlockRenderer is imported lazily to avoid circular dependency
import { lazy, Suspense } from 'react'
const BlockRenderer = lazy(() => import('./BlockRenderer'))

export default function ToggleBlock({ title, content }: ToggleBlockType) {
  return (
    <details className="my-4 rounded-lg border border-[var(--ruled-line-color)] open:pb-2">
      <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-[var(--ink-primary)] hover:bg-[var(--callout-note-bg)]">
        {renderText(title)}
      </summary>
      <div className="px-4 pt-1">
        <Suspense fallback={null}>
          {(content ?? []).map((block) => (
            <BlockRenderer key={block.id} block={block} />
          ))}
        </Suspense>
      </div>
    </details>
  )
}
