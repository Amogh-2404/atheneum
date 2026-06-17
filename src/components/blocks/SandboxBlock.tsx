import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Play, Square, RotateCcw, Check, X } from 'lucide-react'
import { useRunner } from './sandbox/useRunner'
import RunConsole from './sandbox/RunConsole'
import type { EditorApi } from './sandbox/SandboxEditor'
import type { ConsoleLine, RunStatus } from '@/lib/sandbox/types'
import type { SandboxBlock as SandboxBlockType } from '@/types'

const SandboxEditor = lazy(() => import('./sandbox/SandboxEditor'))

type Props = SandboxBlockType & { bookId?: string; chapterId?: string }

export default function SandboxBlock(props: Props) {
  const { language, code, filename, readOnly, lockedRegions, expectedOutput, tests, autorun, timeoutMs, hideEditor } = props
  // static-first: a JS autorun cell mounts the editor immediately; everyone else
  // stays a cheap static preview until first interaction (C12).
  const [activated, setActivated] = useState(() => !!autorun && language !== 'python')
  const editorApi = useRef<EditorApi | null>(null)
  const { status, lines, value, progress, run, stop, reset } = useRunner(language)

  const doRun = useCallback(() => {
    setActivated(true)
    const src = editorApi.current?.getDoc() ?? code
    run(src, timeoutMs)
  }, [code, run, timeoutMs])

  // JS-only autorun, once. Never auto-boots Pyodide.
  const didAuto = useRef(false)
  useEffect(() => {
    if (autorun && language !== 'python' && !didAuto.current) { didAuto.current = true; run(code, timeoutMs) }
  }, [autorun, language, code, timeoutMs, run])

  const doReset = useCallback(() => { editorApi.current?.setDoc(code); reset() }, [code, reset])
  const running = status === 'running' || status === 'booting'
  const testResults = useMemo(() => evalTests(tests, expectedOutput, lines, status), [tests, expectedOutput, lines, status])

  return (
    <div className="not-prose" style={{ margin: 'var(--space-6) 0', borderRadius: 'var(--radius-3)', overflow: 'hidden', border: '1px solid var(--chrome-border)', background: 'var(--chrome-surface)', boxShadow: 'var(--shadow-1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--chrome-border)' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.66rem', fontWeight: 700, color: 'var(--chrome-accent)', letterSpacing: '0.08em' }}>
          {language === 'python' ? 'PY' : language === 'typescript' ? 'TS' : 'JS'}
        </span>
        {filename && <span style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem', color: 'var(--chrome-text)', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</span>}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-ui)', fontSize: '0.62rem', color: 'var(--chrome-text)', opacity: 0.5, whiteSpace: 'nowrap' }}>runs in your browser</span>
      </div>

      {!hideEditor && (activated ? (
        <Suspense fallback={<StaticCode code={code} />}>
          <SandboxEditor initialDoc={code} lang={language} readOnly={readOnly} locked={lockedRegions} onRun={doRun} apiRef={editorApi} />
        </Suspense>
      ) : (
        <button type="button" onClick={() => setActivated(true)} aria-label="Tap to edit this code" style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'text', padding: 0, margin: 0 }}>
          <StaticCode code={code} />
        </button>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderTop: '1px solid var(--chrome-border)' }}>
        {running ? (
          <ToolbarBtn onClick={stop} icon={<Square size={14} strokeWidth={2.4} />} label="Stop" primary />
        ) : (
          <ToolbarBtn onClick={doRun} icon={<Play size={15} strokeWidth={2.4} />} label="Run" primary />
        )}
        <ToolbarBtn onClick={doReset} icon={<RotateCcw size={14} strokeWidth={2.2} />} label="Reset" />
        <StatusPill status={status} />
      </div>

      {(status !== 'idle' || lines.length > 0) && <RunConsole lines={lines} value={value} progress={progress} status={status} />}
      {testResults && testResults.length > 0 && <TestStrip results={testResults} />}
    </div>
  )
}

// ── pieces ──────────────────────────────────────────────────────────
function StaticCode({ code }: { code: string }) {
  return (
    <pre style={{ margin: 0, padding: 'var(--space-3) var(--space-4)', background: 'transparent', color: 'var(--chrome-hover-text)', fontFamily: 'var(--font-code)', fontSize: '16px', lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {code}
    </pre>
  )
}

function ToolbarBtn({ onClick, icon, label, primary }: { onClick: () => void; icon: React.ReactNode; label: string; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '0 14px',
        fontFamily: 'var(--font-ui)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', borderRadius: 'var(--radius-2)',
        color: primary ? 'var(--chrome-bg)' : 'var(--chrome-text)',
        background: primary ? 'var(--chrome-accent)' : 'transparent',
        border: primary ? 'none' : '1px solid var(--chrome-border)',
      }}
    >
      {icon} {label}
    </button>
  )
}

const STATUS_LABEL: Partial<Record<RunStatus, string>> = {
  booting: 'Loading…', running: 'Running…', done: 'Done', error: 'Error', timeout: 'Timed out', unavailable: 'Unavailable',
}
function StatusPill({ status }: { status: RunStatus }) {
  const label = STATUS_LABEL[status]
  if (!label) return null
  const color = status === 'error' || status === 'timeout' ? 'var(--callout-warning-border, #d98a6a)' : status === 'done' ? 'var(--chrome-accent)' : 'var(--chrome-text)'
  return <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-ui)', fontSize: '0.72rem', fontWeight: 500, color, opacity: 0.85 }}>{label}</span>
}

function TestStrip({ results }: { results: { name: string; pass: boolean }[] }) {
  const allPass = results.every((r) => r.pass)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--chrome-border)', background: 'var(--surface-raised)' }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: allPass ? 'var(--accent)' : 'var(--ink-faint)' }}>
        {allPass ? 'All checks passed' : 'Checks'}
      </div>
      {results.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-ui)', fontSize: '0.82rem', color: 'var(--ink-secondary)' }}>
          <span style={{ display: 'inline-flex', color: r.pass ? 'var(--accent)' : 'var(--ink-faint)', flexShrink: 0 }}>
            {r.pass ? <Check size={14} strokeWidth={2.5} /> : <X size={14} strokeWidth={2.5} />}
          </span>
          {r.name}
        </div>
      ))}
    </div>
  )
}

// Evaluate stdout/error-based checks from a completed run. (Robust kinds only;
// unknown kinds stay lenient so a learner is never failed by an unsupported check.)
function evalTests(
  tests: SandboxBlockType['tests'],
  expectedOutput: string | undefined,
  lines: ConsoleLine[],
  status: RunStatus,
): { name: string; pass: boolean }[] | null {
  if (status !== 'done' && status !== 'error' && status !== 'timeout') return null
  const all = [...(tests ?? [])]
  if (expectedOutput != null) all.unshift({ name: 'Expected output', kind: 'stdout-equals', value: expectedOutput })
  if (!all.length) return null
  const stdout = lines.filter((l) => l.stream === 'stdout').map((l) => l.text).join('')
  const ok = status === 'done'
  return all.map((t) => {
    let pass = ok
    if (t.kind === 'no-error') pass = ok
    else if (t.kind === 'stdout-contains') pass = ok && stdout.includes(t.value ?? '')
    else if (t.kind === 'stdout-equals') pass = ok && stdout.trim() === (t.value ?? '').trim()
    return { name: t.name, pass }
  })
}
