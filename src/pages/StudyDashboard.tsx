import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useBook } from '@/hooks/useBook'
import { useLearningProgress } from '@/hooks/useLearningProgress'
import { fetchJSON } from '@/lib/api'
import { renderText } from '@/lib/render-text'
import type { Confidence, CardSRSState } from '@/types/learning'
import type { Chapter } from '@/types'
import { SkeletonBlock, ShimmerStyle } from '@/components/shared/Skeleton'
import ErrorState from '@/components/shared/ErrorState'

const CONFIDENCE_BUTTONS: { key: Confidence; label: string; color: string }[] = [
  { key: 'again', label: 'Again', color: '#dc2626' },
  { key: 'hard', label: 'Hard', color: '#ea580c' },
  { key: 'good', label: 'Good', color: '#16a34a' },
  { key: 'easy', label: 'Easy', color: 'var(--chrome-accent)' },
]

export default function StudyDashboard() {
  const { bookId } = useParams()
  const { book, loading: bookLoading, error: bookError } = useBook(bookId)
  const { progress, getDueCards, recordFlashcardReview } = useLearningProgress(bookId)

  const [chapters, setChapters] = useState<Map<string, Chapter>>(new Map())
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewIdx, setReviewIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [sessionResults, setSessionResults] = useState<Confidence[]>([])

  const dueCards = useMemo(() => getDueCards(), [getDueCards])

  // Fetch chapters containing due cards
  useEffect(() => {
    if (!bookId || dueCards.length === 0) return
    const chapterIds = new Set(dueCards.map(c => {
      const fp = progress?.flashcards[c.blockId]
      return fp?.chapterId ?? ''
    }).filter(Boolean))

    for (const chId of chapterIds) {
      if (chapters.has(chId)) continue
      fetchJSON<Chapter>(`/books/${bookId}/chapters/${chId}`)
        .then(ch => setChapters(prev => new Map(prev).set(chId, ch)))
        .catch(() => { /* ignore */ })
    }
  }, [bookId, dueCards, progress, chapters])

  // Get flashcard content for a due card
  const getCardContent = useCallback((srs: CardSRSState) => {
    const fp = progress?.flashcards[srs.blockId]
    if (!fp) return null
    const chapter = chapters.get(fp.chapterId)
    if (!chapter) return null
    const block = chapter.blocks?.find((b: any) => b.id === srs.blockId && b.type === 'flashcard')
    if (!block || block.type !== 'flashcard') return null
    const card = block.cards?.[srs.cardIndex]
    return card ?? null
  }, [progress, chapters])

  // Quiz scores across chapters
  const quizScores = useMemo(() => {
    if (!progress || !book) return []
    return Object.entries(progress.quizzes).map(([blockId, qp]) => {
      const latest = new Map<string, { correct: boolean }>()
      for (const a of qp.attempts) latest.set(a.questionId, { correct: a.correct })
      const answers = Array.from(latest.values())
      const correct = answers.filter(a => a.correct).length
      return { blockId, chapterId: qp.chapterId, correct, total: answers.length, lastAttemptAt: qp.lastAttemptAt }
    })
  }, [progress, book])

  const overallScore = quizScores.length > 0
    ? Math.round(quizScores.reduce((sum, q) => sum + (q.correct / q.total), 0) / quizScores.length * 100)
    : null

  // Review session
  const handleConfidence = (confidence: Confidence) => {
    const card = dueCards[reviewIdx]
    if (!card) return
    const fp = progress?.flashcards[card.blockId]
    if (fp) recordFlashcardReview(card.blockId, fp.chapterId, card.cardIndex, confidence)
    setSessionResults(prev => [...prev, confidence])
    setFlipped(false)
    if (reviewIdx < dueCards.length - 1) {
      setReviewIdx(i => i + 1)
    } else {
      setReviewMode(false)
    }
  }

  if (bookLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--chrome-bg)', padding: '3rem 2rem' }}>
      <ShimmerStyle />
      <div style={{ maxWidth: 700, margin: '0 auto' }}><SkeletonBlock lines={5} /><SkeletonBlock lines={3} /></div>
    </div>
  )

  if (bookError) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--chrome-bg)' }}>
      <ErrorState message={bookError} icon="error" onRetry={() => window.location.reload()} />
    </div>
  )

  if (!book) return null

  // Session complete
  if (sessionResults.length > 0 && !reviewMode) {
    const good = sessionResults.filter(r => r === 'good' || r === 'easy').length
    return (
      <div style={{ minHeight: '100vh', background: 'var(--chrome-bg)', padding: '3rem 2rem' }}>
        <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, color: '#16a34a', marginBottom: 8 }}>
            Session Complete
          </div>
          <div style={{ fontFamily: 'var(--font-body)', color: 'var(--chrome-text)', marginBottom: 24 }}>
            Reviewed {sessionResults.length} cards — {good} rated Good or Easy
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button type="button" onClick={() => { setSessionResults([]); setReviewIdx(0); setReviewMode(true) }}
              style={{ fontFamily: 'var(--font-ui)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--chrome-accent)', background: 'rgba(47, 92, 138,0.08)', border: '1px solid var(--chrome-accent)', borderRadius: 6, padding: '8px 20px', cursor: 'pointer' }}>
              Review Again
            </button>
            <Link to={`/book/${bookId}`}
              style={{ fontFamily: 'var(--font-ui)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--chrome-text)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--chrome-border)', borderRadius: 6, padding: '8px 20px', textDecoration: 'none' }}>
              Back to Book
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Review mode
  if (reviewMode && dueCards.length > 0) {
    const card = dueCards[reviewIdx]
    const content = card ? getCardContent(card) : null
    return (
      <div style={{ minHeight: '100vh', background: 'var(--chrome-bg)', padding: '3rem 2rem' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem', color: 'var(--chrome-text)' }}>
              Card {reviewIdx + 1} / {dueCards.length}
            </span>
            <button type="button" onClick={() => setReviewMode(false)}
              style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: 'var(--chrome-text)', background: 'none', border: '1px solid var(--chrome-border)', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}>
              Exit
            </button>
          </div>
          <div onClick={() => setFlipped(f => !f)}
            style={{ cursor: 'pointer', border: `2px solid ${flipped ? 'var(--chrome-accent)' : 'var(--chrome-border)'}`, borderRadius: 10, padding: '2rem', minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: flipped ? 'rgba(47, 92, 138,0.03)' : 'transparent', transition: 'border-color 200ms' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--chrome-text)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
              {flipped ? 'Answer' : 'Question'}
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '1.1rem', color: 'var(--chrome-text)', lineHeight: 1.7 }}>
              {content ? renderText(flipped ? content.back : content.front) : 'Loading...'}
            </div>
          </div>
          {flipped && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: 16 }}>
              {CONFIDENCE_BUTTONS.map(({ key, label, color }) => (
                <button key={key} type="button" onClick={() => handleConfidence(key)}
                  style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem', fontWeight: 600, color, background: 'transparent', border: `1.5px solid ${color}`, borderRadius: 6, padding: '8px 18px', cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {!flipped && (
            <div style={{ textAlign: 'center', marginTop: 12, fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: 'var(--ink-faint)' }}>
              Click to reveal answer
            </div>
          )}
        </div>
      </div>
    )
  }

  // Dashboard view
  return (
    <div style={{ minHeight: '100vh', background: 'var(--chrome-bg)', padding: '2rem' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, paddingBottom: 16, borderBottom: '1px solid var(--chrome-border)' }}>
          <div>
            <Link to={`/book/${bookId}`} style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--chrome-muted, var(--ink-faint))', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              &larr; {book.title}
            </Link>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.3rem', fontWeight: 700, color: 'var(--chrome-accent)', margin: '4px 0 0', lineHeight: 1.1 }}>
              Study Dashboard
            </h1>
          </div>
          {overallScore !== null && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--chrome-text)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Comprehension</div>
              <div style={{ fontFamily: 'var(--font-code)', fontFeatureSettings: '"tnum" 1', fontSize: '1.8rem', fontWeight: 700, color: overallScore >= 80 ? '#16a34a' : overallScore >= 50 ? '#ea580c' : '#dc2626' }}>
                {overallScore}%
              </div>
            </div>
          )}
        </div>

        {/* Due Cards */}
        <section style={{ marginBottom: 32, padding: '1.25rem', borderRadius: 10, border: '1px solid var(--chrome-border)', background: 'rgba(47, 92, 138,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--chrome-accent)', margin: 0, letterSpacing: '0.04em' }}>
              Flashcards Due
            </h2>
            <span style={{ fontFamily: 'var(--font-code)', fontFeatureSettings: '"tnum" 1', fontSize: '1.3rem', fontWeight: 700, color: dueCards.length > 0 ? 'var(--chrome-accent)' : 'var(--chrome-text)' }}>
              {dueCards.length}
            </span>
          </div>
          {dueCards.length > 0 ? (
            <button type="button" onClick={() => { setReviewMode(true); setReviewIdx(0); setFlipped(false); setSessionResults([]) }}
              style={{ width: '100%', fontFamily: 'var(--font-ui)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--chrome-bg)', background: 'var(--chrome-accent)', border: 'none', borderRadius: 6, padding: '10px 0', cursor: 'pointer', letterSpacing: '0.03em' }}>
              Start Review
            </button>
          ) : (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--chrome-text)', opacity: 0.6, margin: 0 }}>
              No cards due for review. Check back later.
            </p>
          )}
        </section>

        {/* Quiz Scores */}
        {quizScores.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--chrome-accent)', letterSpacing: '0.04em', marginBottom: 12 }}>
              Quiz Scores
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {quizScores.map(q => (
                <div key={q.blockId} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid var(--chrome-border)',
                }}>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem', color: 'var(--chrome-text)' }}>
                    {q.chapterId.replace(/^\d+-/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-code)', fontFeatureSettings: '"tnum" 1', fontSize: '0.85rem', fontWeight: 700,
                    color: q.correct === q.total ? '#16a34a' : q.correct / q.total >= 0.5 ? '#ea580c' : '#dc2626',
                  }}>
                    {q.correct}/{q.total}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {dueCards.length === 0 && quizScores.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--chrome-text)', opacity: 0.6 }}>
              No study data yet. Answer quizzes and review flashcards in chapters to build your progress.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
