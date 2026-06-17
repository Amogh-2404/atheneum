import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import { ArrowRight, CornerDownRight, GitFork, Map as MapIcon } from 'lucide-react'
import { tween, spring } from '@/lib/motion'
import { useCoarsePointer } from '@/hooks/useIsMobile'
import type { ConceptIndex, Concept } from '@/lib/concept-extractor'

interface TooltipState {
  concept: Concept
  rect: DOMRect
}

const CARD_W = 340
const EST_H = 240
const OPEN_DELAY = 120
const HIDE_DELAY = 300
const MAX_CHIPS = 3

function humanize(slug: string): string {
  return slug.split(/[-_]/).map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ')
}

export default function ConceptTooltip({ conceptIndex }: { conceptIndex: ConceptIndex | null }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()
  const coarse = useCoarsePointer()

  const clearTimers = useCallback(() => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
    if (showTimer.current) { clearTimeout(showTimer.current); showTimer.current = null }
  }, [])
  const scheduleHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setTooltip(null), HIDE_DELAY)
  }, [])

  // by NAME (de-hyphenated), with singular/plural mop-up
  const resolve = useCallback(
    (key: string): Concept | null => {
      if (!conceptIndex) return null
      const m = conceptIndex.concepts
      for (const t of [key, key.replace(/s$/, ''), `${key}s`]) {
        const found = m.get(t)
        if (found) return found
      }
      return null
    },
    [conceptIndex],
  )
  // by SLUG (hyphenated, graph id) — for chip re-point
  const resolveSlug = useCallback(
    (slug: string): Concept | null => conceptIndex?.bySlug.get(slug) ?? null,
    [conceptIndex],
  )
  const chipName = useCallback(
    (slug: string): string => conceptIndex?.bySlug.get(slug)?.name ?? humanize(slug),
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
      const show = () => setTooltip({ concept, rect })
      if (immediate) show()
      else showTimer.current = setTimeout(show, OPEN_DELAY)
    }

    const onEnter = (e: Event) => {
      const t = e.target as HTMLElement
      if (!coarse && t.classList?.contains('concept-ref')) open(t, false)
    }
    const onLeave = (e: Event) => {
      const t = e.target as HTMLElement
      if (!coarse && t.classList?.contains('concept-ref')) {
        if (showTimer.current) { clearTimeout(showTimer.current); showTimer.current = null }
        scheduleHide()
      }
    }
    const onClick = (e: Event) => {
      const t = e.target as HTMLElement
      const ref = t.closest?.('.concept-ref') as HTMLElement | null
      if (ref) { e.preventDefault(); open(ref, true) }
      else if (!t.closest?.('[data-concept-card]')) setTooltip(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { clearTimers(); setTooltip(null) } }
    // Scroll dismiss is a DESKTOP affordance (the card floats with the word). On a
    // touch device the sheet is anchored to the viewport, so scrolling must NOT
    // dismiss it (H7).
    const onScroll = () => { if (!coarse) setTooltip(null) }

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
  }, [conceptIndex, resolve, clearTimers, scheduleHide, coarse])

  // Mark resolved/unresolved so a dead [[ref]] never poses as a live link.
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

  const close = useCallback(() => { clearTimers(); setTooltip(null) }, [clearTimers])

  const goToDefinition = useCallback(() => {
    if (!tooltip) return
    const { bookId, chapterId, blockId } = tooltip.concept
    navigate(`/book/${bookId}/${chapterId}`)
    setTimeout(() => {
      const el = blockId ? document.getElementById(blockId) : null
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.style.outline = '2px solid var(--accent)'
        el.style.outlineOffset = '4px'
        el.style.borderRadius = 'var(--radius-1)'
        el.style.transition = 'outline-color 1.5s ease'
        setTimeout(() => { el.style.outlineColor = 'transparent' }, 1500)
      }
    }, 300)
    setTooltip(null)
  }, [tooltip, navigate])

  const openInMap = useCallback(() => {
    if (!tooltip?.concept.slug) return
    navigate(`/book/${tooltip.concept.bookId}/graph?focus=${tooltip.concept.slug}`)
    setTooltip(null)
  }, [tooltip, navigate])

  // Re-point the card/sheet to a clicked Needs/Unlocks chip — in place, no dismiss.
  const repoint = useCallback((slug: string) => {
    const c = resolveSlug(slug)
    if (c) setTooltip((prev) => (prev ? { concept: c, rect: prev.rect } : null))
  }, [resolveSlug])

  // ── desktop floating-card placement with viewport flip ──
  let top = 0, left = 0, originY = -4
  if (tooltip) {
    const r = tooltip.rect
    left = Math.min(Math.max(r.left + r.width / 2 - CARD_W / 2, 12), window.innerWidth - CARD_W - 12)
    const roomBelow = window.innerHeight - r.bottom
    if (roomBelow < EST_H + 16 && r.top > EST_H + 16) { top = r.top - 8 - EST_H; originY = 4 }
    else { top = r.bottom + 8 }
  }

  if (!tooltip) return null
  const c = tooltip.concept

  const body = (
    <Body c={c} chipName={chipName} onChip={repoint} onGoToDef={goToDefinition} onOpenMap={openInMap} />
  )

  if (coarse) {
    return createPortal(
      <AnimatePresence>
        <motion.div
          key="scrim"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={close}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.4)' }}
        />
        <motion.div
          key="sheet"
          data-concept-card
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={spring.default}
          drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.5 }}
          onDragEnd={(_e: unknown, info: PanInfo) => { if (info.velocity.y > 400 || info.offset.y > 80) close() }}
          style={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1001,
            maxHeight: '70svh', display: 'flex', flexDirection: 'column',
            background: 'var(--chrome-surface)', borderTop: '1px solid var(--chrome-border)',
            borderRadius: 'var(--radius-4) var(--radius-4) 0 0', boxShadow: 'var(--shadow-4)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <div style={{ flexShrink: 0, padding: '10px 0 2px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--chrome-border)' }} />
          </div>
          <div style={{ overflowY: 'auto', padding: 'var(--space-2) var(--space-5) var(--space-5)' }}>{body}</div>
        </motion.div>
      </AnimatePresence>,
      document.body,
    )
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        data-concept-card
        initial={{ opacity: 0, y: originY }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: originY }}
        transition={tween.fast}
        onMouseEnter={clearTimers}
        onMouseLeave={scheduleHide}
        style={{
          position: 'fixed', top, left, width: CARD_W, zIndex: 1000,
          background: 'var(--chrome-glass)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
          border: '1px solid var(--chrome-border)', borderRadius: 'var(--radius-3)', boxShadow: 'var(--shadow-4)',
          padding: 'var(--space-3) var(--space-4)', pointerEvents: 'auto',
        }}
      >
        {body}
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

// ── shared card body (same content, two shells) ──
function Body({ c, chipName, onChip, onGoToDef, onOpenMap }: {
  c: Concept
  chipName: (slug: string) => string
  onChip: (slug: string) => void
  onGoToDef: () => void
  onOpenMap: () => void
}) {
  const needs = c.prerequisites ?? []
  const unlocks = c.dependents ?? []
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 'var(--space-2)' }}>
        <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-heading)', fontSize: '1.12rem', fontWeight: 600, color: 'var(--chrome-hover-text)', lineHeight: 1.25 }}>
          {c.name}
        </div>
        {c.seenCount != null && c.seenCount > 0 && (
          <span style={{ flexShrink: 0, marginTop: 2, fontFamily: 'var(--font-ui)', fontSize: '0.6rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--chrome-text)', opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
            in {c.seenCount} chapter{c.seenCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.92rem', color: 'var(--chrome-text)', opacity: c.definition ? 0.88 : 0.6, fontStyle: c.definition ? 'normal' : 'italic', lineHeight: 1.5, marginBottom: (needs.length || unlocks.length) ? 'var(--space-3)' : 'var(--space-2)', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {c.definition || 'Defined in the map — no inline definition yet.'}
      </div>

      {needs.length > 0 && <ChipRow icon={<CornerDownRight size={11} strokeWidth={2.4} />} label="Needs" slugs={needs} chipName={chipName} onChip={onChip} />}
      {unlocks.length > 0 && <ChipRow icon={<GitFork size={11} strokeWidth={2.4} style={{ transform: 'rotate(180deg)' }} />} label="Unlocks" slugs={unlocks} chipName={chipName} onChip={onChip} />}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
        {c.definition !== '' && c.blockId && (
          <button type="button" onClick={onGoToDef} style={footerBtn}>
            <ArrowRight size={14} strokeWidth={2} aria-hidden /> Go to definition
          </button>
        )}
        {c.inGraph && c.slug && (
          <button type="button" onClick={onOpenMap} style={footerBtn}>
            <MapIcon size={14} strokeWidth={2} aria-hidden /> Open in map
          </button>
        )}
      </div>
    </>
  )
}

function ChipRow({ icon, label, slugs, chipName, onChip }: {
  icon: React.ReactNode
  label: string
  slugs: string[]
  chipName: (slug: string) => string
  onChip: (slug: string) => void
}) {
  const shown = slugs.slice(0, MAX_CHIPS)
  const extra = slugs.length - shown.length
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-ui)', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--chrome-accent)', flexShrink: 0 }}>
        {icon}{label}
      </span>
      {shown.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChip(s)}
          style={{
            display: 'inline-flex', alignItems: 'center', minHeight: 30, padding: '4px 9px',
            fontFamily: 'var(--font-ui)', fontSize: '0.74rem', fontWeight: 500, color: 'var(--chrome-hover-text)',
            background: 'var(--chrome-bg)', border: '1px solid var(--chrome-border)',
            borderLeft: '2px solid var(--chrome-accent)', borderRadius: 'var(--radius-1)', cursor: 'pointer', maxWidth: '100%',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chipName(s)}</span>
        </button>
      ))}
      {extra > 0 && (
        <span style={{ fontFamily: 'var(--font-code)', fontSize: '0.7rem', color: 'var(--chrome-text)', opacity: 0.6 }}>+{extra}</span>
      )}
    </div>
  )
}

const footerBtn: React.CSSProperties = {
  fontFamily: 'var(--font-ui)', fontSize: '0.78rem', fontWeight: 500, color: 'var(--chrome-accent)',
  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: 40,
}
