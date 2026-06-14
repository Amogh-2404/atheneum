/* ─── Learning Progress Hook ───────────────────────────────────────────
   Follows the same pattern as useAnnotations:
   - localStorage is source of truth (instant)
   - Server sync is fire-and-forget (background)
   - Server wins on conflict (by updatedAt)
────────────────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  LearningProgress,
  QuizAttempt,
  Confidence,
  CardSRSState,
  UserFlashcard,
} from '@/types/learning'
import { computeNextReview, createInitialSRS, isDue } from '@/lib/srs'

// ─── Storage ─────────────────────────────────────────────────────────

function storageKey(bookId: string) {
  return `atheneum-learning-${bookId}`
}

function loadProgress(bookId: string): LearningProgress {
  try {
    const raw = localStorage.getItem(storageKey(bookId))
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return { bookId, quizzes: {}, flashcards: {}, srs: [], userCards: [], updatedAt: new Date().toISOString() }
}

function saveProgress(bookId: string, data: LearningProgress) {
  data.updatedAt = new Date().toISOString()
  localStorage.setItem(storageKey(bookId), JSON.stringify(data))
}

function syncToServer(bookId: string, data: LearningProgress) {
  fetch(`/api/learning-progress/${bookId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => { /* fire-and-forget */ })
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useLearningProgress(bookId?: string) {
  const [progress, setProgress] = useState<LearningProgress | null>(null)
  const hasFetchedRef = useRef<string | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    if (!bookId) return
    setProgress(loadProgress(bookId))
  }, [bookId])

  // Fetch from server and merge (server wins by updatedAt)
  useEffect(() => {
    if (!bookId || hasFetchedRef.current === bookId) return
    hasFetchedRef.current = bookId

    fetch(`/api/learning-progress/${bookId}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then((data: { progress: LearningProgress | null }) => {
        if (!data.progress) return
        const server = data.progress
        setProgress(prev => {
          if (!prev || server.updatedAt > prev.updatedAt) {
            saveProgress(bookId, server)
            return server
          }
          return prev
        })
      })
      .catch(() => { /* server unavailable */ })
  }, [bookId])

  // Persist to localStorage + server on every change
  useEffect(() => {
    if (!bookId || !progress) return
    saveProgress(bookId, progress)
    syncToServer(bookId, progress)
  }, [bookId, progress])

  // ─── Quiz API ────────────────────────────────────────────────────

  const recordQuizAnswer = useCallback((
    blockId: string,
    chapterId: string,
    questionId: string,
    selectedIndex: number,
    correct: boolean,
  ) => {
    if (!bookId) return
    const attempt: QuizAttempt = {
      questionId,
      selectedIndex,
      correct,
      timestamp: new Date().toISOString(),
    }
    setProgress(prev => {
      if (!prev) return prev
      const existing = prev.quizzes[blockId] || { blockId, chapterId, attempts: [], lastAttemptAt: '' }
      return {
        ...prev,
        quizzes: {
          ...prev.quizzes,
          [blockId]: {
            ...existing,
            attempts: [...existing.attempts, attempt],
            lastAttemptAt: attempt.timestamp,
          },
        },
      }
    })
  }, [bookId])

  const getQuizScore = useCallback((blockId: string) => {
    if (!progress?.quizzes[blockId]) return null
    const qp = progress.quizzes[blockId]
    if (qp.attempts.length === 0) return null

    // Get the most recent attempt per question
    const latest = new Map<string, QuizAttempt>()
    for (const a of qp.attempts) {
      latest.set(a.questionId, a)
    }
    const answers = Array.from(latest.values())
    const correct = answers.filter(a => a.correct).length
    return { correct, total: answers.length, lastAttemptAt: qp.lastAttemptAt }
  }, [progress])

  const resetQuiz = useCallback((blockId: string) => {
    if (!bookId) return
    setProgress(prev => {
      if (!prev) return prev
      const { [blockId]: _, ...rest } = prev.quizzes
      return { ...prev, quizzes: rest }
    })
  }, [bookId])

  // ─── Flashcard API ───────────────────────────────────────────────

  const recordFlashcardReview = useCallback((
    blockId: string,
    chapterId: string,
    cardIndex: number,
    confidence: Confidence,
  ) => {
    if (!bookId) return
    const now = new Date().toISOString()
    setProgress(prev => {
      if (!prev) return prev

      // Update flashcard block progress
      const existing = prev.flashcards[blockId] || { blockId, chapterId, reviews: [], lastReviewedAt: '' }
      const flashcards = {
        ...prev.flashcards,
        [blockId]: {
          ...existing,
          reviews: [...existing.reviews, { cardIndex, confidence, timestamp: now }],
          lastReviewedAt: now,
        },
      }

      // Update SRS state
      let srs = [...prev.srs]
      let cardState = srs.find(s => s.blockId === blockId && s.cardIndex === cardIndex)
      if (!cardState) {
        cardState = createInitialSRS(blockId, cardIndex)
        srs.push(cardState)
      }
      const updated = computeNextReview(cardState, confidence)
      srs = srs.map(s => (s.blockId === blockId && s.cardIndex === cardIndex) ? updated : s)

      return { ...prev, flashcards, srs }
    })
  }, [bookId])

  const getCardState = useCallback((blockId: string, cardIndex: number): CardSRSState | null => {
    return progress?.srs.find(s => s.blockId === blockId && s.cardIndex === cardIndex) ?? null
  }, [progress])

  const getDueCards = useCallback((): CardSRSState[] => {
    return (progress?.srs ?? []).filter(isDue)
  }, [progress])

  const getLastReview = useCallback((blockId: string, cardIndex: number) => {
    const reviews = progress?.flashcards[blockId]?.reviews ?? []
    const matching = reviews.filter(r => r.cardIndex === cardIndex)
    return matching.length > 0 ? matching[matching.length - 1] : null
  }, [progress])

  // ─── User Flashcard API ──────────────────────────────────────────

  const addUserFlashcard = useCallback((card: Omit<UserFlashcard, 'id' | 'createdAt'>) => {
    if (!bookId) return
    const id = `ufc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const newCard: UserFlashcard = { ...card, id, createdAt: new Date().toISOString() }
    setProgress(prev => {
      if (!prev) return prev
      const srs = [...prev.srs, createInitialSRS(id, 0)]
      return { ...prev, userCards: [...prev.userCards, newCard], srs }
    })
  }, [bookId])

  return {
    progress,
    // Quiz
    recordQuizAnswer,
    getQuizScore,
    resetQuiz,
    // Flashcard
    recordFlashcardReview,
    getCardState,
    getDueCards,
    getLastReview,
    // User cards
    addUserFlashcard,
  }
}
