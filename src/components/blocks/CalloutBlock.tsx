import type { ComponentType } from 'react'
import {
  Info,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  StickyNote,
} from 'lucide-react'
import type { CalloutBlock as CalloutBlockType } from '@/types'
import { renderText } from '@/lib/render-text'

type LucideIcon = ComponentType<{ size?: number | string; strokeWidth?: number | string; 'aria-hidden'?: boolean }>

const variantConfig: Record<
  CalloutBlockType['variant'],
  { Icon: LucideIcon; hue: string }
> = {
  note: { Icon: Info, hue: 'var(--callout-note-border)' },
  tip: { Icon: Lightbulb, hue: 'var(--callout-tip-border)' },
  warning: { Icon: AlertTriangle, hue: 'var(--callout-warning-border)' },
  example: { Icon: CheckCircle2, hue: 'var(--callout-example-border)' },
  'key-concept': { Icon: KeyRound, hue: 'var(--callout-key-concept-border)' },
  definition: { Icon: StickyNote, hue: 'var(--callout-definition-border)' },
}

export default function CalloutBlock({ variant, title, text, icon }: CalloutBlockType) {
  const config = variantConfig[variant] ?? variantConfig.note
  const { Icon, hue } = config
  const label = title ?? variant.replace('-', ' ')

  return (
    <aside
      className="codex-callout"
      data-variant={variant}
      style={{
        // semantic hue resolved once, consumed by rule + tint + eyebrow
        ['--hue' as string]: hue,
        display: 'flex',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-2)',
        borderLeft: '2px solid var(--hue)',
        background: 'color-mix(in srgb, var(--hue) 8%, var(--paper-bg))',
        margin: 'var(--space-4) 0',
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'flex-start',
          paddingTop: '0.1em',
          color: 'var(--hue)',
        }}
      >
        {icon ? (
          <span style={{ fontSize: '1rem', lineHeight: 1 }}>{icon}</span>
        ) : (
          <Icon size={18} strokeWidth={2} aria-hidden />
        )}
      </span>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          className="codex-callout__eyebrow"
          style={{
            fontFamily: 'var(--font-ui)',
            fontWeight: 600,
            fontSize: '0.7rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--hue)',
            marginBottom: 'var(--space-2)',
          }}
        >
          {label}
        </div>
        <div
          className="codex-callout__body"
          style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--ink-primary)',
            lineHeight: 1.7,
          }}
        >
          {renderText(text)}
        </div>
      </div>
    </aside>
  )
}
