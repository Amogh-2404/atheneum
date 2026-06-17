import { useEffect, useState } from 'react'

/**
 * Shared viewport + input-modality hooks (deduped from PreferencesPanel and
 * ChapterNav, which each had a private copy).
 *
 * - useIsMobile(bp) — width gate, for layout-fit decisions (sandbox console, etc.)
 * - useCoarsePointer() — input modality, for "is this a touch device" decisions.
 *   Gate the hovercard bottom-sheet on THIS, not width: a tap on a large touch
 *   laptop should still get a sheet, and a narrow desktop window should not.
 */
export function useIsMobile(breakpoint = 768) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < breakpoint)
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const on = () => setM(mql.matches)
    on()
    mql.addEventListener('change', on)
    return () => mql.removeEventListener('change', on)
  }, [breakpoint])
  return m
}

export function useCoarsePointer() {
  const [c, setC] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)
  useEffect(() => {
    const mql = window.matchMedia('(pointer: coarse)')
    const on = () => setC(mql.matches)
    on()
    mql.addEventListener('change', on)
    return () => mql.removeEventListener('change', on)
  }, [])
  return c
}
