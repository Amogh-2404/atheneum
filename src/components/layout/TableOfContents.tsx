import type { Block, HeadingBlock } from '@/types'

interface TOCProps {
  blocks: Block[]
  activeHeadingId: string | null
}

interface TOCEntry {
  id: string
  level: 1 | 2 | 3
  text: string
  anchor: string
}

/** Extract plain text from a TextContent value */
function extractText(content: HeadingBlock['text']): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((s) => s.text).join('')
  return ''
}

/** Pull heading blocks from the flat block list */
function extractHeadings(blocks: Block[]): TOCEntry[] {
  return blocks
    .filter((b): b is HeadingBlock => b.type === 'heading')
    .map((b) => ({
      id: b.id,
      level: b.level,
      text: extractText(b.text),
      anchor: b.anchor ?? b.id,
    }))
}

export default function TableOfContents({ blocks, activeHeadingId }: TOCProps) {
  const headings = extractHeadings(blocks)

  if (headings.length === 0) return null

  function scrollTo(anchor: string) {
    const el = document.getElementById(anchor)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const indent: Record<number, number> = { 1: 0, 2: 12, 3: 24 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <p
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '0.65rem',
          color: 'var(--chrome-text)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          margin: '0 0 6px 0',
          opacity: 0.6,
        }}
      >
        On this page
      </p>
      {headings.map((h) => {
        const isActive = activeHeadingId === h.anchor
        return (
          <button
            type="button"
            key={h.id}
            onClick={() => scrollTo(h.anchor)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '3px 8px',
              paddingLeft: indent[h.level] + 8,
              borderLeft: isActive
                ? '3px solid var(--chrome-accent)'
                : '3px solid transparent',
              color: isActive ? 'var(--chrome-accent)' : 'var(--chrome-text)',
              fontFamily: 'var(--font-ui)',
              fontSize: '13px',
              fontWeight: isActive ? 600 : 400,
              lineHeight: 1.4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: 'color 200ms ease, border-color 200ms ease',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--chrome-hover-text, #f1f5f9)'
            }}
            onMouseLeave={(e) => {
              if (!isActive)
                e.currentTarget.style.color = 'var(--chrome-text)'
            }}
          >
            {h.text}
          </button>
        )
      })}
    </div>
  )
}
