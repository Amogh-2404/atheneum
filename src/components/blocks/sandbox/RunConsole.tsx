import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import type { ConsoleLine, RunStatus } from '@/lib/sandbox/types'

/** stdout/stderr/system + final value. Capped at 40svh with internal scroll so a
 *  chatty program never blows the page out (C6); padded for the iOS keyboard. */
export default function RunConsole({ lines, value, progress }: {
  lines: ConsoleLine[]
  value: string | null
  progress: string | null
  status: RunStatus
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight }, [lines, value])
  const empty = lines.length === 0 && value == null && !progress
  return (
    <div
      ref={ref}
      style={{
        maxHeight: '40svh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        padding: 'var(--space-3) var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom, 0px))',
        background: 'var(--chrome-bg)', borderTop: '1px solid var(--chrome-border)',
        fontFamily: 'var(--font-code)', fontSize: '0.8rem', lineHeight: 1.55,
      }}
    >
      {progress && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--chrome-accent)', fontFamily: 'var(--font-ui)', fontSize: '0.78rem' }}>
          <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }} style={{ display: 'inline-flex' }}>
            <Loader2 size={13} strokeWidth={2.2} />
          </motion.span>
          {progress}
        </div>
      )}
      {empty && !progress && (
        <div style={{ color: 'var(--chrome-text)', opacity: 0.5, fontStyle: 'italic', fontFamily: 'var(--font-ui)', fontSize: '0.78rem' }}>Output appears here.</div>
      )}
      {lines.map((l, i) => (
        <pre
          key={i}
          style={{
            margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            fontStyle: l.stream === 'system' ? 'italic' : 'normal',
            color: l.stream === 'stderr' ? 'var(--callout-warning-border, #d98a6a)' : l.stream === 'system' ? 'var(--chrome-text)' : 'var(--chrome-hover-text)',
            opacity: l.stream === 'system' ? 0.75 : 1,
          }}
        >{l.text}</pre>
      ))}
      {value != null && value !== '' && (
        <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--chrome-accent)' }}>⮑ {value}</pre>
      )}
    </div>
  )
}
