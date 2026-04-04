import type { CalloutBlock as CalloutBlockType } from '@/types'
import { renderText } from '@/lib/render-text'
import RoughBox from '@/components/shared/RoughBox'

const variantConfig: Record<
  CalloutBlockType['variant'],
  { icon: string; borderColor: string; cssClass: string }
> = {
  definition: {
    icon: '\ud83d\udcd6',
    borderColor: 'var(--callout-definition-border)',
    cssClass: 'callout-definition',
  },
  example: {
    icon: '\ud83d\udca1',
    borderColor: 'var(--callout-example-border)',
    cssClass: 'callout-example',
  },
  'key-concept': {
    icon: '\ud83d\udd11',
    borderColor: 'var(--callout-key-concept-border)',
    cssClass: 'callout-key-concept',
  },
  warning: {
    icon: '\u26a0\ufe0f',
    borderColor: 'var(--callout-warning-border)',
    cssClass: 'callout-warning',
  },
  tip: {
    icon: '\u2728',
    borderColor: 'var(--callout-tip-border)',
    cssClass: 'callout-tip',
  },
  note: {
    icon: '\ud83d\udcdd',
    borderColor: 'var(--callout-note-border)',
    cssClass: 'callout-note',
  },
}

export default function CalloutBlock({ variant, title, text, icon }: CalloutBlockType) {
  const config = variantConfig[variant] ?? variantConfig.note
  // Derive a seed from the variant for consistent wobble
  const seed = variant.length * 13 + 7

  return (
    <RoughBox
      seed={seed}
      stroke={config.borderColor}
      strokeWidth={1.5}
      roughness={1.0}
      padding="0"
    >
      <aside className={`callout ${config.cssClass}`} data-variant={variant}>
        {(title || icon) && (
          <div className="callout-title">
            <span>{icon ?? config.icon}</span>
            <span>{title ?? variant.replace('-', ' ')}</span>
          </div>
        )}
        <div className="callout-body">
          {renderText(text)}
        </div>
      </aside>
    </RoughBox>
  )
}
