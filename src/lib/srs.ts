/* ─── SM-2 Spaced Repetition Algorithm ─────────────────────────────────
   Simplified SuperMemo-2. Pure functions, no side effects.
────────────────────────────────────────────────────────────────────── */

import type { CardSRSState, Confidence } from '@/types/learning'

const MIN_EASE = 1.3

export function createInitialSRS(blockId: string, cardIndex: number): CardSRSState {
  const now = new Date().toISOString()
  return {
    blockId,
    cardIndex,
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    nextReviewAt: now,
    lastReviewedAt: now,
  }
}

export function computeNextReview(state: CardSRSState, confidence: Confidence): CardSRSState {
  const now = new Date()
  let { interval, easeFactor, repetitions } = state

  switch (confidence) {
    case 'again':
      interval = 1
      repetitions = 0
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.2)
      break
    case 'hard':
      interval = Math.max(1, Math.round(interval * 1.2))
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.15)
      break
    case 'good':
      if (repetitions === 0) {
        interval = 1
      } else if (repetitions === 1) {
        interval = 3
      } else {
        interval = Math.round(interval * easeFactor)
      }
      repetitions++
      break
    case 'easy':
      if (repetitions === 0) {
        interval = 2
      } else if (repetitions === 1) {
        interval = 4
      } else {
        interval = Math.round(interval * easeFactor * 1.3)
      }
      easeFactor += 0.15
      repetitions++
      break
  }

  const nextDate = new Date(now)
  nextDate.setDate(nextDate.getDate() + interval)

  return {
    ...state,
    interval,
    easeFactor,
    repetitions,
    nextReviewAt: nextDate.toISOString(),
    lastReviewedAt: now.toISOString(),
  }
}

export function isDue(state: CardSRSState): boolean {
  return new Date(state.nextReviewAt) <= new Date()
}
