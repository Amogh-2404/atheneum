/// <reference lib="webworker" />
// Python execution worker. Pyodide's ~10 MB wasm/stdlib streams from the jsDelivr
// CDN at runtime (NOT bundled — see vite.config SW rule) and boots LAZILY on the
// first Run, never on page load (R1). The `started` message fires AFTER boot so the
// main-thread watchdog never trips during a slow cold-load over Tailscale.
import { loadPyodide, version, type PyodideInterface } from 'pyodide'
import type { RunMsg, OutMsg } from './types'

const ctx = self as unknown as DedicatedWorkerGlobalScope
const post = (m: OutMsg) => ctx.postMessage(m)

let pyodide: PyodideInterface | null = null
let booting: Promise<PyodideInterface> | null = null

function boot(): Promise<PyodideInterface> {
  if (pyodide) return Promise.resolve(pyodide)
  if (booting) return booting
  booting = (async () => {
    post({ kind: 'progress', text: 'Downloading Python runtime…' })
    const py = await loadPyodide({ indexURL: `https://cdn.jsdelivr.net/pyodide/v${version}/full/` })
    pyodide = py
    post({ kind: 'progress', text: 'Python ready', pct: 100 })
    post({ kind: 'ready' })
    return py
  })()
  return booting
}

ctx.onmessage = async (e: MessageEvent<RunMsg>) => {
  const msg = e.data
  if (msg.kind !== 'run') return
  const { id, code } = msg
  let py: PyodideInterface
  try {
    py = await boot()
  } catch (err) {
    booting = null
    post({ kind: 'error', id, message: `Couldn't load the Python runtime — ${err instanceof Error ? err.message : String(err)}` })
    return
  }

  py.setStdout({ batched: (s: string) => post({ kind: 'out', id, stream: 'stdout', chunk: s + '\n' }) })
  py.setStderr({ batched: (s: string) => post({ kind: 'out', id, stream: 'stderr', chunk: s + '\n' }) })

  post({ kind: 'started', id }) // boot done — execution begins, watchdog starts now
  let result: unknown
  try {
    await py.loadPackagesFromImports(code).catch(() => { /* missing pkg surfaces as ImportError below */ })
    result = await py.runPythonAsync(code)
    if (result != null) {
      let repr: string
      try { repr = (result as { toString?: () => string }).toString?.() ?? String(result) } catch { repr = String(result) }
      if (repr && repr !== 'undefined') post({ kind: 'value', id, repr })
    }
    post({ kind: 'done', id })
  } catch (err) {
    post({ kind: 'error', id, message: err instanceof Error ? err.message : String(err) })
  } finally {
    const r = result as { destroy?: () => void } | undefined
    if (r && typeof r.destroy === 'function') { try { r.destroy() } catch { /* already freed */ } }
  }
}
