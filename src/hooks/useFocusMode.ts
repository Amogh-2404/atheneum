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
            visibleBlocks.set(id, entry.intersectionRatio)
          } else {
            visibleBlocks.delete(id)
          }
        }

        // Find the block with the highest intersection ratio
        let bestId: string | null = null
        let bestRatio = 0
        for (const [id, ratio] of visibleBlocks) {
          if (ratio > bestRatio) {
            bestRatio = ratio
            bestId = id
          }
        }

        if (bestId) setFocusedBlockId(bestId)
      },
      {
        root: null, // viewport
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0],
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
