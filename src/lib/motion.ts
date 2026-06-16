/**
 * Motion SSOT — the single spring/tween vocabulary for Atheneum.
 *
 * Model: Motion's duration+bounce spring API (the mental model Apple shipped at
 * WWDC23), not stiffness/damping. Rule of thumb:
 *   - things that MOVE  (position / scale a user can interrupt) → spring.*
 *   - things that FADE  (opacity / color / filter)             → tween.*
 * Springs stay continuous when interrupted; tweening an interruptible transform
 * produces the "jerk to a halt" stutter. Bounce is capped at 0.3 — past ~0.4 a
 * UI element reads as cartoonish (Apple's own ceiling).
 *
 * NOTE: the cubic-beziers below are house / Material-derived curves, NOT
 * Apple-published constants — decisive defaults, not a borrowed identity.
 */
import type { Transition } from 'framer-motion'

const cubic = (a: number, b: number, c: number, d: number): [number, number, number, number] => [a, b, c, d]

export const spring = {
  /** default UI motion — calm, no bounce */
  default: { type: 'spring' as const, visualDuration: 0.3, bounce: 0 },
  /** tap / press feedback — quick, the faintest life */
  press: { type: 'spring' as const, visualDuration: 0.2, bounce: 0.15 },
  /** page / route transitions */
  page: { type: 'spring' as const, visualDuration: 0.45, bounce: 0.15 },
  /** shared-element / layout morphs */
  layout: { type: 'spring' as const, visualDuration: 0.35, bounce: 0.2 },
  /** ONE deliberate accent moment — never on body text or reading flow */
  accent: { type: 'spring' as const, visualDuration: 0.5, bounce: 0.3 },
} satisfies Record<string, Transition>

export const tween = {
  fast: { duration: 0.15, ease: cubic(0.4, 0, 0.2, 1) },
  base: { duration: 0.25, ease: cubic(0.4, 0, 0.2, 1) },
  /** decelerate — for things entering the screen */
  enter: { duration: 0.35, ease: cubic(0, 0, 0.2, 1) },
  /** accelerate — for things leaving the screen */
  exit: { duration: 0.2, ease: cubic(0.4, 0, 1, 1) },
} satisfies Record<string, Transition>

/** Uniform press feedback — spread onto any interactive motion element. */
export const pressable = {
  whileTap: { scale: 0.97 },
  transition: spring.press,
}

/** Scroll-into-view reveal — the gentle micro-hook, fired once. */
export const reveal = {
  initial: { opacity: 0, y: 6 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '0px 0px -8% 0px' },
  transition: tween.enter,
}
