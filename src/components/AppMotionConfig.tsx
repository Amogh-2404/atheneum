import { useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'

/**
 * Bridges the in-app "reduce motion" preference into framer-motion.
 *
 * PreferencesPanel writes [data-reduced-motion] straight onto <html> (there is
 * no shared prefs context), and the CSS in accessibility.css already neutralises
 * CSS transitions/animations off that attribute. This makes the SAME toggle
 * govern framer's JS-driven animations too:
 *   - in-app toggle ON  → "always" (force-reduce regardless of OS)
 *   - in-app toggle OFF → "user"   (still honor the OS prefers-reduced-motion)
 * "user"/"always" replace transforms while preserving opacity — Apple's
 * "replace, don't remove" rule — so nothing vanishes, it just stops moving.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-reduced-motion'],
  })
  return () => observer.disconnect()
}

function getSnapshot(): boolean {
  return document.documentElement.getAttribute('data-reduced-motion') === 'true'
}

export function AppMotionConfig({ children }: { children: ReactNode }) {
  const reduced = useSyncExternalStore(subscribe, getSnapshot, () => false)
  return <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>{children}</MotionConfig>
}
