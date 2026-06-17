import type { DividerBlock as DividerBlockType } from '@/types'

export default function DividerBlock({ style }: DividerBlockType) {
  // An asterism (⁂) reads as a quiet section break; a hairline reads as a hard
  // stop. Map the legacy decorative styles onto these two crisp primitives.
  const asterism = style === 'dots' || style === 'flourish'

  if (asterism) {
    return (
      <div
        role="separator"
        aria-orientation="horizontal"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 'var(--space-7) 0',
          color: 'var(--ink-faint)',
          fontFamily: 'var(--font-body)',
          fontSize: '1.25rem',
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        <span aria-hidden="true">⁂</span>
      </div>
    )
  }

  return (
    <hr
      style={{
        border: 'none',
        borderTop: 'var(--hairline)',
        height: 0,
        margin: 'var(--space-7) 0',
      }}
    />
  )
}
