interface Props {
  currentChapter: any
  historicalChapter: any
}

// Icons for block types
const typeIcons: Record<string, string> = {
  text: '\u00b6',       // pilcrow
  code: '</>',
  diagram: '\u25a1',    // square
  callout: '\u25c6',    // diamond
  heading: 'H',
  image: '\u25a3',      // filled square
  table: '\u2261',      // triple bar
  math: '\u03a3',       // sigma
  quiz: '?',
  list: '\u2022',       // bullet
}

function getBlockSummary(block: any): string {
  if (block.title) return block.title
  if (block.type === 'heading' && block.content) return block.content
  if (block.type === 'text' && block.content) {
    const plain = block.content.replace(/<[^>]+>/g, '').replace(/[#*_~`]/g, '')
    return plain.length > 60 ? plain.slice(0, 57) + '...' : plain
  }
  if (block.type === 'code' && block.language) return `${block.language} block`
  if (block.type === 'callout' && block.label) return block.label
  return block.type
}

function blockFingerprint(block: any): string {
  // Create a simple fingerprint from type + id + content length + first chunk
  const content = JSON.stringify(block)
  return `${block.type}:${block.id}:${content.length}:${content.slice(0, 200)}`
}

export default function DiffViewer({ currentChapter, historicalChapter }: Props) {
  const currentBlocks = currentChapter?.blocks ?? []
  const historicalBlocks = historicalChapter?.blocks ?? []

  // Build fingerprint maps for quick comparison
  const currentFingerprints = new Map<string, string>()
  currentBlocks.forEach((b: any) => {
    currentFingerprints.set(b.id, blockFingerprint(b))
  })

  const historicalFingerprints = new Map<string, string>()
  historicalBlocks.forEach((b: any) => {
    historicalFingerprints.set(b.id, blockFingerprint(b))
  })

  // Classify blocks
  const currentIds = new Set<string>(currentBlocks.map((b: any) => b.id as string))
  const historicalIds = new Set<string>(historicalBlocks.map((b: any) => b.id as string))

  // Blocks that exist in both but have different content
  const modifiedIds = new Set<string>()
  for (const id of currentIds) {
    if (historicalIds.has(id)) {
      const cf = currentFingerprints.get(id)
      const hf = historicalFingerprints.get(id)
      if (cf !== hf) modifiedIds.add(id)
    }
  }

  // Blocks only in current (added since historical)
  const addedIds = new Set<string>()
  for (const id of currentIds) {
    if (!historicalIds.has(id)) addedIds.add(id)
  }

  // Blocks only in historical (removed since then)
  const removedIds = new Set<string>()
  for (const id of historicalIds) {
    if (!currentIds.has(id)) removedIds.add(id)
  }

  const totalChanges = modifiedIds.size + addedIds.size + removedIds.size

  return (
    <div
      style={{
        background: 'var(--chrome-surface)',
        border: '1px solid var(--chrome-border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Summary header */}
      <div
        style={{
          padding: '0.6rem 0.9rem',
          borderBottom: '1px solid var(--chrome-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: 'var(--font-ui)',
          fontSize: '0.72rem',
          letterSpacing: '0.03em',
          textTransform: 'uppercase',
          color: 'var(--chrome-text)',
        }}
      >
        <span>
          <strong style={{ color: '#e2e8f0' }}>{historicalBlocks.length}</strong> blocks then
        </span>
        <span style={{ color: 'var(--chrome-accent)' }}>&#8594;</span>
        <span>
          <strong style={{ color: '#e2e8f0' }}>{currentBlocks.length}</strong> blocks now
        </span>
        <span style={{ marginLeft: 'auto', color: totalChanges > 0 ? 'var(--chrome-accent)' : '#4ade80' }}>
          {totalChanges > 0
            ? `${totalChanges} change${totalChanges !== 1 ? 's' : ''}`
            : 'identical'}
        </span>
      </div>

      {/* Side by side comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 80 }}>
        {/* Left: Current */}
        <div
          style={{
            borderRight: '1px solid var(--chrome-border)',
            padding: '0.5rem 0',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.6rem',
              color: 'var(--chrome-accent)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '0 0.75rem 0.35rem',
              fontWeight: 700,
            }}
          >
            Current
          </div>
          {currentBlocks.map((block: any) => {
            const isAdded = addedIds.has(block.id)
            const isModified = modifiedIds.has(block.id)
            return (
              <div
                key={block.id}
                style={{
                  padding: '0.25rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.75rem',
                  color: isAdded ? '#4ade80' : isModified ? '#f59e0b' : 'var(--chrome-text)',
                  background: isAdded
                    ? 'rgba(74, 222, 128, 0.06)'
                    : isModified
                    ? 'rgba(245, 158, 11, 0.06)'
                    : 'transparent',
                  lineHeight: 1.5,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.65rem',
                    opacity: 0.6,
                    minWidth: 22,
                    textAlign: 'center',
                  }}
                >
                  {typeIcons[block.type] ?? block.type[0]?.toUpperCase()}
                </span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {getBlockSummary(block)}
                </span>
                {isAdded && (
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, flexShrink: 0 }}>+NEW</span>
                )}
                {isModified && (
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, flexShrink: 0 }}>MOD</span>
                )}
              </div>
            )
          })}
          {currentBlocks.length === 0 && (
            <div
              style={{
                padding: '1rem 0.75rem',
                fontFamily: 'var(--font-ui)',
                fontSize: '0.75rem',
                color: 'var(--chrome-text)',
                opacity: 0.5,
                textAlign: 'center',
              }}
            >
              No blocks
            </div>
          )}
        </div>

        {/* Right: Historical */}
        <div style={{ padding: '0.5rem 0' }}>
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.6rem',
              color: 'var(--chrome-text)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              padding: '0 0.75rem 0.35rem',
              fontWeight: 700,
            }}
          >
            Selected
          </div>
          {historicalBlocks.map((block: any) => {
            const isRemoved = removedIds.has(block.id)
            const isModified = modifiedIds.has(block.id)
            return (
              <div
                key={block.id}
                style={{
                  padding: '0.25rem 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.75rem',
                  color: isRemoved ? '#f87171' : isModified ? '#f59e0b' : 'var(--chrome-text)',
                  background: isRemoved
                    ? 'rgba(248, 113, 113, 0.06)'
                    : isModified
                    ? 'rgba(245, 158, 11, 0.06)'
                    : 'transparent',
                  lineHeight: 1.5,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: '0.65rem',
                    opacity: 0.6,
                    minWidth: 22,
                    textAlign: 'center',
                  }}
                >
                  {typeIcons[block.type] ?? block.type[0]?.toUpperCase()}
                </span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {getBlockSummary(block)}
                </span>
                {isRemoved && (
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, flexShrink: 0 }}>DEL</span>
                )}
                {isModified && (
                  <span style={{ fontSize: '0.6rem', fontWeight: 700, flexShrink: 0 }}>MOD</span>
                )}
              </div>
            )
          })}
          {historicalBlocks.length === 0 && (
            <div
              style={{
                padding: '1rem 0.75rem',
                fontFamily: 'var(--font-ui)',
                fontSize: '0.75rem',
                color: 'var(--chrome-text)',
                opacity: 0.5,
                textAlign: 'center',
              }}
            >
              No blocks
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
