import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { tween } from '@/lib/motion'
import type { ConceptIndex, Concept } from '@/lib/concept-extractor'

interface TooltipState {
  name: string
  definition: string
  bookId: string
  chapterId: string
  blockId: string
  rect: DOMRect
}

const CARD_W = 320
const EST_H = 168
const OPEN_DELAY = 120 // shorter than Wikipedia's 150 — definitions are local, no fetch
const HIDE_DELAY = 300 // abandon grace so the cursor can travel link -> card

export default function ConceptTooltip({ conceptIndex }: { conceptIndex: ConceptIndex | null }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()

  const clearTimers = useCallback(() => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
    if (showTimer.current) { clearTimeout(showTimer.current); showTimer.current = null }
  }, [])
  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setTooltip(null), HIDE_DELAY)
  }, [])

  // Resolution ladder: the slug is already normalized to match concept keys
  // (lower + [-_]->space), so this only mops up singular/plural drift.
  const resolve = useCallback(
    (key: string): Concept | null => {
      if (!conceptIndex) return null
      const m = conceptIndex.concepts
      const tries = [key, key.replace(/s$/, ''), `${key}s`]
      for (const t of tries) {
        const found = m.get(t)
        if (found) return found
      }
      return null
    },
    [conceptIndex],
  )

  useEffect(() => {
    if (!conceptIndex) return

    const open = (target: HTMLElement, immediate: boolean) => {
      const key = target.getAttribute('data-concept')
      if (!key) return
      const concept = resolve(key)
      if (!concept) return
      clearTimers()
      const rect = target.getBoundingClientRect()
      const show = () =>
        setTooltip({
          name: concept.name,
          definition: concept.definition,
          bookId: concept.bookId,
          chapterId: concept.chapterId,
          blockId: concept.blockId,
          rect,
        })
      if (immediate) show()
      else showTimer.current = setTimeout(show, OPEN_DELAY)
    }

    const onEnter = (e: Event) => {
      const t = e.target as HTMLElement
      if (t.classList?.contains('concept-ref')) open(t, false)
    }
    const onLeave = (e: Event) => {
      const t = e.target as HTMLElement
      if (t.classList?.contains('concept-ref')) {
        if (showTimer.current) { clearTimeout(showTimer.current); showTimer.current = null }
        scheduleHide()
      }
    }
    // Tap / click path (touch has no hover) — opens immediately; also lets a
    // click-outside dismiss.
    const onClick = (e: Event) => {
      const t = e.target as HTMLElement
      const ref = t.closest?.('.concept-ref') as HTMLElement | null
      if (ref) { e.preventDefault(); open(ref, true) }
      else if (!t.closest?.('[data-concept-card]')) setTooltip(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { clearTimers(); setTooltip(null) } }
    const onScroll = () => setTooltip(null)

    document.addEventListener('mouseenter', onEnter, true)
    document.addEventListener('mouseleave', onLeave, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mouseenter', onEnter, true)
      document.removeEventListener('mouseleave', onLeave, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      clearTimers()
    }
  }, [conceptIndex, resolve, clearTimers, scheduleHide])

  // Down-style links that resolve to no definition so a fake-live cyan link
  // never sits in the prose doing nothing on hover (the amateur tell). Marks
  // every .concept-ref with data-resolved; CSS mutes the misses.
  useEffect(() => {
    if (!conceptIndex) return
    let scheduled = false
    const mark = () => {
      scheduled = false
      document.querySelectorAll<HTMLElement>('.concept-ref').forEach((el) => {
        const key = el.getAttribute('data-concept') || ''
        el.dataset.resolved = resolve(key) ? 'true' : 'false'
      })
    }
    const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(mark) } }
    schedule()
    const obs = new MutationObserver(schedule)
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [conceptIndex, resolve])

  const goToDefinition = useCallback(() => {
    if (!tooltip) return
    const { bookId, chapterId, blockId } = tooltip
    navigate(`/book/${bookId}/${chapterId}`)
    setTimeout(() => {
      const el = document.getElementById(blockId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.style.outline = '2px solid var(--chrome-accent)'
        el.style.outlineOffset = '4px'
        el.style.borderRadius = 'var(--radius-1)'
        el.style.transition = 'outline-color 1.5s ease'
        setTimeout(() => { el.style.outlineColor = 'transparent' }, 1500)
      }
    }, 300)
    setTooltip(null)
  }, [tooltip, navigate])

  // ── Fixed-position placement with viewport flip (portaled to body) ──
  let top = 0, left = 0, originY = -4
  if (tooltip) {
    const r = tooltip.rect
    left = Math.min(Math.max(r.left + r.width / 2 - CARD_W / 2, 12), window.innerWidth - CARD_W - 12)
    const roomBelow = window.innerHeight - r.bottom
    if (roomBelow < EST_H + 16 && r.top > EST_H + 16) {
      top = r.top - 8 - EST_H // flip above
      originY = 4
    } else {
      top = r.bottom + 8
    }
  }

  return createPortal(
    <AnimatePresence>
      {tooltip && (
        <motion.div
          data-concept-card
          initial={{ opacity: 0, y: originY }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: originY }}
          transition={tween.fast}
          onMouseEnter={clearTimers}
          onMouseLeave={scheduleHide}
          style={{
            position: 'fixed',
            top,
            left,
            width: CARD_W,
            zIndex: 1000,
            background: 'var(--chrome-glass)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            border: '1px solid var(--chrome-border)',
            borderRadius: 'var(--radius-3)',
            boxShadow: 'var(--shadow-4)',
            padding: 'var(--space-3) var(--space-4)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--chrome-accent)', marginBottom: 'var(--space-2)', lineHeight: 1.3 }}>
            {tooltip.name}
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.92rem', color: 'var(--chrome-text)', opacity: 0.85, lineHeight: 1.5, marginBottom: 'var(--space-3)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {tooltip.definition}
          </div>
          <button
            type="button"
            onClick={goToDefinition}
            style={{ fontFamily: 'var(--font-ui)', fontSize: '0.78rem', fontWeight: 500, color: 'var(--chrome-accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: 44 }}
          >
            <ArrowRight size={14} strokeWidth={2} aria-hidden /> Go to definition
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
