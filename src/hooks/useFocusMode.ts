import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Focus mode: dims all blocks except the one currently in the viewport center.
 * Returns the ID of the "focused" block and a toggle function.
 */
export function useFocusMode(contentRef: React.RefObject<HTMLElement | null>) {
  const [active, setActive] = useState(false)
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const toggle = useCallback(() => setActive(v => !v), [])

  useEffect(() => {
    if (!active || !contentRef.current) {
      setFocusedBlockId(null)
      return
    }

    const container = contentRef.current
    // Track which blocks are visible and how much
    const visibleBlocks = new Map<string, number>()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id
          if (!id) continue
          if (entry.isIntersecting) {
            visibleBlocks.set(id, entry.boundingClientRect.top)
          } else {
            visibleBlocks.delete(id)
          }
        }

        // The focused block is the one crossing the reading line — among the
        // blocks inside the band, pick the topmost (smallest top).
        let bestId: string | null = null
        let bestTop = Infinity
        for (const [id, top] of visibleBlocks) {
          if (top < bestTop) {
            bestTop = top
            bestId = id
          }
        }

        if (bestId) setFocusedBlockId(bestId)
      },
      {
        root: null, // viewport
        // A thin band at ~1/3 down from the top, so the block you're actively
        // reading (between top and middle) lights up — not whatever fills the screen.
        rootMargin: '-30% 0px -60% 0px',
        threshold: 0,
      }
    )

    // Observe all direct children with IDs (blocks)
    const children = container.querySelectorAll('[id^="blk_"]')
    children.forEach(child => observerRef.current!.observe(child))

    return () => {
      observerRef.current?.disconnect()
      visibleBlocks.clear()
    }
  }, [active, contentRef])

  return { focusModeActive: active, focusedBlockId, toggleFocusMode: toggle }
}
