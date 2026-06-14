/* ─── Learning Progress Types ──────────────────────────────────────────
   Tracks quiz answers, flashcard reviews, and SRS scheduling.
   Stored in localStorage + server (.state/learning-progress.json).
────────────────────────────────────────────────────────────────────── */

// ─── Quiz ────────────────────────────────────────────────────────────

export interface QuizAttempt {
  questionId: string
  selectedIndex: number
  correct: boolean
  timestamp: string
}

export interface QuizBlockProgress {
  blockId: string
  chapterId: string
  attempts: QuizAttempt[]
  lastAttemptAt: string
}

// ─── Flashcards ──────────────────────────────────────────────────────

export type Confidence = 'again' | 'hard' | 'good' | 'easy'

export interface FlashcardReview {
  cardIndex: number
  confidence: Confidence
  timestamp: string
}

export interface FlashcardBlockProgress {
  blockId: string
  chapterId: string
  reviews: FlashcardReview[]
  lastReviewedAt: string
}

// ─── Spaced Repetition (SM-2) ────────────────────────────────────────

export interface CardSRSState {
  blockId: string
  cardIndex: number
  interval: number          // days until next review
  easeFactor: number        // SM-2 ease factor (starts at 2.5)
  repetitions: number       // consecutive correct
  nextReviewAt: string      // ISO date
  lastReviewedAt: string
}

// ─── User-Created Flashcards ─────────────────────────────────────────

export interface UserFlashcard {
  id: string
  bookId: string
  chapterId: string
  blockId: string
  front: string
  back: string
  createdAt: string
}

// ─── Top-Level Progress ──────────────────────────────────────────────

export interface LearningProgress {
  bookId: string
  quizzes: Record<string, QuizBlockProgress>       // keyed by blockId
  flashcards: Record<string, FlashcardBlockProgress>
  srs: CardSRSState[]
  userCards: UserFlashcard[]
  updatedAt: string
}
