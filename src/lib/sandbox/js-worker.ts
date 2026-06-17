/// <reference lib="webworker" />
// JS/TS execution worker. sucrase strips TS types, then the code runs in an
// async IIFE via indirect eval. The worker is sandboxed BY CONSTRUCTION — no DOM
// (it's a worker) and network primitives are nulled, so user code can't phone home.
// Infinite loops are handled on the MAIN thread (terminate + respawn) — a worker
// can't interrupt its own synchronous loop.
import { transform } from 'sucrase'
import type { RunMsg, OutMsg } from './types'

const ctx = self as unknown as DedicatedWorkerGlobalScope
const post = (m: OutMsg) => ctx.postMessage(m)

// Cut every network/escape hatch a sandbox shouldn't have.
for (const k of ['fetch', 'XMLHttpRequest', 'WebSocket', 'importScripts', 'EventSource']) {
  try { Object.defineProperty(ctx, k, { value: undefined, configurable: true }) } catch { /* frozen — ignore */ }
}

function repr(v: unknown): string {
  if (v === undefined) return ''
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(
      v,
      (_k, val) =>
        typeof val === 'bigint' ? `${val}n`
        : typeof val === 'function' ? `[Function: ${val.name || 'anonymous'}]`
        : val,
      2,
    ) ?? String(v)
  } catch { return String(v) }
}

ctx.onmessage = async (e: MessageEvent<RunMsg>) => {
  const msg = e.data
  if (msg.kind !== 'run') return
  const { id, code } = msg

  const orig = { log: console.log, info: console.info, debug: console.debug, warn: console.warn, error: console.error }
  const fmt = (args: unknown[]) => args.map((a) => (typeof a === 'string' ? a : repr(a))).join(' ') + '\n'
  console.log = console.info = console.debug = (...a: unknown[]) => post({ kind: 'out', id, stream: 'stdout', chunk: fmt(a) })
  console.warn = console.error = (...a: unknown[]) => post({ kind: 'out', id, stream: 'stderr', chunk: fmt(a) })

  post({ kind: 'started', id }) // boot is instant for JS; watchdog starts now
  try {
    // sucrase as a pure type-stripper (works for plain JS too). Wrap in an async
    // IIFE so top-level await is legal; explicit `return x` surfaces a value.
    const stripped = transform(code, { transforms: ['typescript'], disableESTransforms: true }).code
    const fn = (0, eval)(`(async () => {\n${stripped}\n})`) as () => Promise<unknown>
    const value = await fn()
    if (value !== undefined) post({ kind: 'value', id, repr: repr(value) })
    post({ kind: 'done', id })
  } catch (err) {
    const message = err instanceof Error ? (err.stack || `${err.name}: ${err.message}`) : String(err)
    post({ kind: 'error', id, message })
  } finally {
    Object.assign(console, orig)
  }
}

post({ kind: 'ready' })
