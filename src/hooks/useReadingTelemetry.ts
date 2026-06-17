import { useEffect, useRef } from 'react'
import { openDB, type IDBPDatabase } from 'idb'
import type { BlockDelta, StruggleFlush } from '@/types/telemetry'

// Reading telemetry: one IntersectionObserver + one activity clock. Dwell only
// accrues while the tab is foreground AND the reader was active in the last 5s
// (Chartbeat engaged-time) — without this a tab left open overnight reports
// hours of "struggle". Raw never leaves the device as raw; aggregated per-block
// deltas flush to /api/struggle, which fuses them into a score the Forge reads.
const DWELL_TICK_MS = 1000
const IDLE_MS = 5000
const FLUSH_MS = 12000
const DB_NAME = 'atheneum-telemetry'
const STORE = 'pending'
const WPM_KEY = 'atheneum-wpm'
const WPM_SEED = 238 // Brysbaert 2019 silent-reading mean — only a seed; blended toward the reader's own

function readWpm(): number {
  const v = Number(localStorage.getItem(WPM_KEY))
  return v >= 80 && v <= 1000 ? v : WPM_SEED
}
function blendWpm(wordsRead: number, engagedMs: number) {
  if (engagedMs < 5000 || wordsRead < 25) return
  const s = wordsRead / (engagedMs / 60000)
  if (s < 60 || s > 1000) return
  localStorage.setItem(WPM_KEY, String(Math.round(readWpm() * 0.8 + s * 0.2)))
}

interface SessionBlock { dwellMs: number; revisits: number; words: number; expectedMs: number }

let dbp: Promise<IDBPDatabase> | null = null
function db() {
  if (!dbp) dbp = openDB(DB_NAME, 1, { upgrade(d) { if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE) } })
  return dbp
}

export function useReadingTelemetry(bookId: string | undefined, chapterId: string | undefined) {
  const session = useRef<Map<string, SessionBlock>>(new Map())
  const visible = useRef<Set<string>>(new Set())
  const seen = useRef<Set<string>>(new Set())
  const lastActivity = useRef<number>(Date.now())

  useEffect(() => {
    if (!bookId || !chapterId) return
    const wpm = readWpm()
    session.current = new Map()
    visible.current = new Set()
    seen.current = new Set()

    const ensure = (el: Element, id: string): SessionBlock => {
      let s = session.current.get(id)
      if (!s) {
        const words = (el.textContent || '').trim().split(/\s+/).filter(Boolean).length
        s = { dwellMs: 0, revisits: 0, words, expectedMs: Math.round((words / wpm) * 60000) }
        session.current.set(id, s)
      }
      return s
    }

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = (e.target as HTMLElement).dataset.blockId
        if (!id) continue
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          ensure(e.target, id)
          if (!visible.current.has(id)) {
            visible.current.add(id)
            if (seen.current.has(id)) ensure(e.target, id).revisits += 1 // re-read = comprehension difficulty
            seen.current.add(id)
          }
        } else {
          visible.current.delete(id)
        }
      }
    }, { threshold: [0, 0.5, 1] })

    const observeAll = () => document.querySelectorAll('[data-block-id]').forEach((el) => io.observe(el))
    observeAll()
    const t0 = setTimeout(observeAll, 400) // blocks may mount after this effect
    const t1 = setTimeout(observeAll, 1200)

    const bump = () => { lastActivity.current = Date.now() }
    window.addEventListener('pointermove', bump, { passive: true })
    window.addEventListener('scroll', bump, { passive: true, capture: true })
    window.addEventListener('keydown', bump)

    const tick = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastActivity.current > IDLE_MS) return
      visible.current.forEach((id) => {
        const s = session.current.get(id)
        if (s) s.dwellMs = Math.min(180000, s.dwellMs + DWELL_TICK_MS)
      })
    }, DWELL_TICK_MS)

    const buildDeltas = (): BlockDelta[] => {
      const out: BlockDelta[] = []
      session.current.forEach((s, blockId) => {
        if (s.dwellMs > 0 || s.revisits > 0) out.push({ blockId, dwellMs: s.dwellMs, revisits: s.revisits, expectedMs: s.expectedMs })
      })
      return out
    }
    const resetDeltas = () => session.current.forEach((s) => { s.dwellMs = 0; s.revisits = 0 })

    const flush = async (useBeacon = false) => {
      const blocks = buildDeltas()
      if (!blocks.length) return
      let words = 0, engaged = 0
      session.current.forEach((s) => { if (s.dwellMs > 0) { words += s.words; engaged += s.dwellMs } })
      blendWpm(words, engaged)
      const payload: StruggleFlush = { chapterId, wpm: readWpm(), blocks }
      const url = `/api/struggle/${bookId}`
      try {
        if (useBeacon && navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([JSON.stringify(payload)], { type: 'application/json' }))
          resetDeltas()
          return
        }
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true })
        if (r.ok) { resetDeltas(); db().then((d) => d.delete(STORE, 'unsent')).catch(() => {}) }
        else { db().then((d) => d.put(STORE, payload, 'unsent')).catch(() => {}) }
      } catch {
        db().then((d) => d.put(STORE, payload, 'unsent')).catch(() => {})
      }
    }

    const flushInterval = setInterval(() => { void flush() }, FLUSH_MS)
    const onHide = () => { if (document.visibilityState === 'hidden') void flush(true) }
    document.addEventListener('visibilitychange', onHide)

    // Recover any payload a prior session failed to send.
    db().then((d) => d.get(STORE, 'unsent')).then((p) => {
      if (!p) return
      fetch(`/api/struggle/${bookId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
        .then((r) => { if (r.ok) db().then((d) => d.delete(STORE, 'unsent')) })
        .catch(() => {})
    }).catch(() => {})

    return () => {
      clearInterval(tick)
      clearInterval(flushInterval)
      clearTimeout(t0)
      clearTimeout(t1)
      window.removeEventListener('pointermove', bump)
      window.removeEventListener('scroll', bump, true)
      window.removeEventListener('keydown', bump)
      document.removeEventListener('visibilitychange', onHide)
      io.disconnect()
      void flush()
    }
  }, [bookId, chapterId])
}
