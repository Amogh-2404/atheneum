import { useEffect, useRef, useState } from 'react'

/**
 * The single source of scroll truth for cinematic blocks: ONE IntersectionObserver,
 * ZERO scroll listeners, zero per-frame getBoundingClientRect. The trigger is a
 * zero-height line at the viewport middle (rootMargin in %, so it rides the iOS
 * URL-bar resize without a remeasure). IO reports settled compositor positions, so
 * it's robust under momentum fling — the active step is always correct once motion
 * settles, and never pops out of order. SSR / no-IO → the final step (fully built).
 */
export function useActiveStep(count: number) {
  const [active, setActive] = useState(0)
  const refs = useRef<(HTMLElement | null)[]>([])
  const visible = useRef(new Map<number, boolean>())

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') { setActive(Math.max(0, count - 1)); return }
    const els = refs.current.slice(0, count)
    const present = els.filter(Boolean) as HTMLElement[]
    if (!present.length) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = els.indexOf(e.target as HTMLElement)
          if (i >= 0) visible.current.set(i, e.isIntersecting)
        }
        let act = -1
        visible.current.forEach((v, i) => { if (v && i > act) act = i })
        if (act >= 0) setActive(act) // gaps between steps keep the last value (no flicker)
      },
      { root: null, rootMargin: '-50% 0px -50% 0px', threshold: 0 },
    )
    present.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [count])

  const setStepRef = (i: number) => (el: HTMLElement | null) => { refs.current[i] = el }
  return { active, setStepRef }
}
