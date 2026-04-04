import { useState, useEffect } from 'react'

/**
 * Tracks which heading element (marked with data-heading-id) is currently
 * visible near the top of the viewport using IntersectionObserver.
 */
export function useActiveHeading(): string | null {
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const headings = document.querySelectorAll('[data-heading-id]')
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible heading
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible.length > 0) {
          setActiveId(visible[0].target.getAttribute('data-heading-id'))
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    )

    headings.forEach((h) => observer.observe(h))
    return () => observer.disconnect()
  }, [])

  return activeId
}
