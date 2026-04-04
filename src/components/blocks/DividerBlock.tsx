import type { DividerBlock as DividerBlockType } from '@/types'
import RoughDivider from '@/components/shared/RoughDivider'

export default function DividerBlock({ style }: DividerBlockType) {
  return (
    <RoughDivider
      style={style ?? 'line'}
      seed={style === 'dots' ? 13 : style === 'wave' ? 29 : style === 'flourish' ? 47 : 7}
      stroke="var(--ink-faint)"
    />
  )
}
