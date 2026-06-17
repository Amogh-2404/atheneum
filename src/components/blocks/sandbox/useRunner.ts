import { useCallback, useEffect, useRef, useState } from 'react'
import { SandboxRunner, type RunnerEvent } from '@/lib/sandbox/runnerClient'
import type { ConsoleLine, RunStatus, SandboxLang } from '@/lib/sandbox/types'

export interface RunState {
  status: RunStatus
  lines: ConsoleLine[]
  value: string | null
  progress: string | null
}

const INITIAL: RunState = { status: 'idle', lines: [], value: null, progress: null }

/** Owns the SandboxRunner and projects its events into render-ready state. */
export function useRunner(lang: SandboxLang) {
  const [state, setState] = useState<RunState>(INITIAL)
  const runnerRef = useRef<SandboxRunner | null>(null)
  const activeId = useRef(0)

  const ensure = useCallback(() => {
    if (!runnerRef.current) {
      runnerRef.current = new SandboxRunner(lang, (e: RunnerEvent) => setState((s) => reduce(s, e, activeId.current)))
    }
    return runnerRef.current
  }, [lang])

  // tear down on unmount AND on language change (a fresh runner per language)
  useEffect(() => () => { runnerRef.current?.dispose(); runnerRef.current = null }, [])
  useEffect(() => { runnerRef.current?.dispose(); runnerRef.current = null; setState(INITIAL) }, [lang])

  const run = useCallback((code: string, timeoutMs?: number) => {
    const r = ensure()
    setState({ status: lang === 'python' ? 'booting' : 'running', lines: [], value: null, progress: null })
    activeId.current = r.run(code, timeoutMs)
  }, [ensure, lang])

  const stop = useCallback(() => {
    runnerRef.current?.stop()
    setState((s) => ({ ...s, status: 'idle', lines: [...s.lines, { stream: 'system', text: 'Stopped.' }] }))
  }, [])

  const reset = useCallback(() => setState(INITIAL), [])

  return { ...state, run, stop, reset }
}

function reduce(s: RunState, e: RunnerEvent, activeId: number): RunState {
  switch (e.kind) {
    case 'progress': return { ...s, status: 'booting', progress: e.text }
    case 'ready': return s
    case 'started': return { ...s, status: 'running', progress: null }
    case 'out': return e.id === activeId ? { ...s, lines: [...s.lines, { stream: e.stream, text: e.chunk }] } : s
    case 'value': return e.id === activeId ? { ...s, value: e.repr } : s
    case 'done': return e.id === activeId ? { ...s, status: 'done' } : s
    case 'error': return e.id === activeId ? { ...s, status: 'error', lines: [...s.lines, { stream: 'stderr', text: e.message }] } : s
    case 'timeout': return e.id === activeId ? { ...s, status: 'timeout', lines: [...s.lines, { stream: 'system', text: 'Timed out — execution stopped.' }] } : s
    default: return s
  }
}
