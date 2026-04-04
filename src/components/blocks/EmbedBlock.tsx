import type { EmbedBlock as EmbedBlockType } from '@/types'

export default function EmbedBlock({ url, title, description }: EmbedBlockType) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="my-4 block rounded-lg border border-[var(--border)] p-4 transition-colors hover:bg-[var(--code-bg)]"
    >
      {title && (
        <div className="font-semibold text-[var(--text-h)]">{title}</div>
      )}
      {description && (
        <div className="mt-1 text-sm text-[var(--text)]">{description}</div>
      )}
      <div className="mt-2 truncate text-xs text-gray-400">{url}</div>
    </a>
  )
}
