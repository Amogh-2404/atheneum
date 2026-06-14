import type { EmbedBlock as EmbedBlockType } from '@/types'

export default function EmbedBlock({ url, title, description }: EmbedBlockType) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="my-4 block rounded-lg border border-[var(--ruled-line-color)] p-4 transition-colors hover:bg-[var(--callout-note-bg)]"
    >
      {title && (
        <div className="font-semibold text-[var(--ink-primary)]">{title}</div>
      )}
      {description && (
        <div className="mt-1 text-sm text-[var(--ink-secondary)]">{description}</div>
      )}
      <div className="mt-2 truncate text-xs text-gray-400">{url}</div>
    </a>
  )
}
