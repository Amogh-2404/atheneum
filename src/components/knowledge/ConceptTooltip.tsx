import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { ConceptIndex } from '@/lib/concept-extractor'

interface TooltipState {
  concept: string
  name: string
  definition: string
  bookId: string
  chapterId: string
  blockId: string
  rect: DOMRect
}

export default function ConceptTooltip({
  conceptIndex,
}: {
  conceptIndex: ConceptIndex | null
}) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    clearHideTimer()
    hideTimerRef.current = setTimeout(() => setTooltip(null), 200)
  }, [clearHideTimer])

  useEffect(() => {
    if (!conceptIndex) return

    function onMouseEnter(e: Event) {
      const target = e.target as HTMLElement
      if (!target.classList.contains('concept-ref')) return

      const conceptKey = target.getAttribute('data-concept')
      if (!conceptKey) return

      const concept = conceptIndex!.concepts.get(conceptKey)
      if (!concept) return

      clearHideTimer()
      const rect = target.getBoundingClientRect()
      setTooltip({
        concept: conceptKey,
        name: concept.name,
        definition: concept.definition,
        bookId: concept.bookId,
        chapterId: concept.chapterId,
        blockId: concept.blockId,
        rect,
      })
    }

    function onMouseLeave(e: Event) {
      const target = e.target as HTMLElement
      if (!target.classList.contains('concept-ref')) return
      scheduleHide()
    }

    document.addEventListener('mouseenter', onMouseEnter, true)
    document.addEventListener('mouseleave', onMouseLeave, true)

    return () => {
      document.removeEventListener('mouseenter', onMouseEnter, true)
      document.removeEventListener('mouseleave', onMouseLeave, true)
      clearHideTimer()
    }
  }, [conceptIndex, clearHideTimer, scheduleHide])

  const goToDefinition = useCallback(() => {
    if (!tooltip) return
    navigate(`/book/${tooltip.bookId}/${tooltip.chapterId}`)
    // Scroll to block after navigation
    setTimeout(() => {
      const el = document.getElementById(tooltip.blockId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Flash highlight
        el.style.outline = '2px solid var(--chrome-accent)'
        el.style.outlineOffset = '4px'
        el.style.borderRadius = '4px'
        el.style.transition = 'outline-color 1.5s ease'
        setTimeout(() => {
          el.style.outlineColor = 'transparent'
        }, 1500)
      }
    }, 300)
    setTooltip(null)
  }, [tooltip, navigate])

  // Calculate position
  const getPosition = useCallback(() => {
    if (!tooltip) return { top: 0, left: 0 }
    const { rect } = tooltip
    const tooltipWidth = 320
    let left = rect.left + rect.width / 2 - tooltipWidth / 2
    // Clamp to viewport
    if (left < 12) left = 12
    if (left + tooltipWidth > window.innerWidth - 12) {
      left = window.innerWidth - tooltipWidth - 12
    }
    const top = rect.bottom + window.scrollY + 8
    return { top, left }
  }, [tooltip])

  const pos = getPosition()

  return (
    <AnimatePresence>
      {tooltip && (
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          onMouseEnter={clearHideTimer}
          onMouseLeave={scheduleHide}
          style={{
            position: 'absolute',
            top: pos.top,
            left: pos.left,
            width: 320,
            zIndex: 1000,
            background: 'var(--chrome-surface)',
            border: '1px solid var(--chrome-accent)',
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(82, 254, 254, 0.1)',
            padding: '12px 16px',
            pointerEvents: 'auto',
          }}
        >
          {/* Concept name */}
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.15rem',
              fontWeight: 700,
              color: 'var(--chrome-accent)',
              marginBottom: 6,
              lineHeight: 1.3,
            }}
          >
            {tooltip.name}
          </div>

          {/* Definition */}
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.95rem',
              color: 'var(--ink-primary, #cbd5e1)',
              lineHeight: 1.5,
              marginBottom: 10,
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {tooltip.definition}
          </div>

          {/* Go to definition link */}
          <button
            onClick={goToDefinition}
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.75rem',
              color: 'var(--chrome-accent)',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              letterSpacing: '0.03em',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'opacity 200ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            <span style={{ fontSize: '0.85rem' }}>&rarr;</span>
            Go to definition
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
