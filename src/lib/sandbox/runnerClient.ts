// Main-thread controller for a sandbox worker. Owns the worker lifecycle and the
// INFINITE-LOOP defence: a worker can't interrupt its own synchronous loop, so we
// arm a watchdog when execution actually starts (the `started` message, fired AFTER
// any Pyodide cold-load) and, if it doesn't finish in time, terminate() the worker
// and respawn a clean one. Same mechanism backs the user-facing Stop button.
import type { OutMsg, RunMsg, SandboxLang } from './types'

const DEFAULT_TIMEOUT: Record<SandboxLang, number> = { javascript: 3000, typescript: 3000, python: 10000 }

export type RunnerEvent = OutMsg | { kind: 'timeout'; id: number }

export class SandboxRunner {
  private worker: Worker | null = null
  private watchdog: ReturnType<typeof setTimeout> | null = null
  private currentId = 0
  private currentTimeout = 0
  private lang: SandboxLang
  private onEvent: (e: RunnerEvent) => void

  constructor(lang: SandboxLang, onEvent: (e: RunnerEvent) => void) {
    this.lang = lang
    this.onEvent = onEvent
  }

  private spawn() {
    // The `new Worker(new URL('./x.ts', import.meta.url), …)` form must be written
    // INLINE with a literal path — Rollup's static analysis won't follow a variable,
    // so a hoisted URL silently emits no worker chunk in the production build (works
    // in dev, crashes in prod). Hence the explicit branch.
    const w = this.lang === 'python'
      ? new Worker(new URL('./py-worker.ts', import.meta.url), { type: 'module' })
      : new Worker(new URL('./js-worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<OutMsg>) => this.handle(e.data)
    w.onerror = (e) => {
      this.clearWatchdog()
      this.onEvent({ kind: 'error', id: this.currentId, message: e.message || 'The sandbox worker crashed.' })
      this.respawn()
    }
    w.onmessageerror = () => this.onEvent({ kind: 'error', id: this.currentId, message: 'The sandbox sent an unreadable message.' })
    this.worker = w
  }

  private handle(m: OutMsg) {
    if (m.kind === 'started') this.armWatchdog()
    else if (m.kind === 'done' || m.kind === 'error') this.clearWatchdog()
    this.onEvent(m)
  }

  private armWatchdog() {
    this.clearWatchdog()
    this.watchdog = setTimeout(() => {
      this.respawn()
      this.onEvent({ kind: 'timeout', id: this.currentId })
    }, this.currentTimeout)
  }
  private clearWatchdog() { if (this.watchdog) { clearTimeout(this.watchdog); this.watchdog = null } }
  private respawn() { this.worker?.terminate(); this.worker = null; this.spawn() }

  run(code: string, timeoutMs?: number): number {
    if (!this.worker) this.spawn()
    this.currentId += 1
    this.currentTimeout = timeoutMs && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT[this.lang]
    const msg: RunMsg = { kind: 'run', id: this.currentId, code }
    this.worker!.postMessage(msg)
    return this.currentId
  }

  /** User pressed Stop (or a timeout): kill the worker, respawn a clean one. */
  stop() { this.clearWatchdog(); this.respawn() }

  dispose() { this.clearWatchdog(); this.worker?.terminate(); this.worker = null }
}
