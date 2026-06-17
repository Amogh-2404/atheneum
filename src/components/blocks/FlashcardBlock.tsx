import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { FlashcardBlock as FlashcardBlockType } from '@/types'
import type { Confidence } from '@/types/learning'
import { renderText } from '@/lib/render-text'
import { useLearningProgress } from '@/hooks/useLearningProgress'

const CONFIDENCE_BUTTONS: { key: Confidence; label: string; color: string }[] = [
  { key: 'again', label: 'Again', color: '#dc2626' },
  { key: 'hard', label: 'Hard', color: '#ea580c' },
  { key: 'good', label: 'Good', color: '#16a34a' },
  { key: 'easy', label: 'Easy', color: 'var(--chrome-accent)' },
]

interface FlashcardBlockProps extends FlashcardBlockType {
  bookId?: string
  chapterId?: string
}

export default function FlashcardBlock({ id: blockId, cards, bookId, chapterId }: FlashcardBlockProps) {
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [direction, setDirection] = useState(0)
  const [sessionComplete, setSessionComplete] = useState(false)

  const { recordFlashcardReview, getLastReview } = useLearningProgress(bookId)
  const hasProgress = !!bookId

  if (!cards || cards.length === 0) return null

  const card = cards[current]

  const flip = () => setFlipped(f => !f)

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= cards.length || idx === current) return
    setDirection(idx > current ? 1 : -1)
    setCurrent(idx)
    setFlipped(false)
  }, [current, cards.length])

  const prev = () => goTo(current - 1)
  const next = () => {
    if (current === cards.length - 1) {
      setSessionComplete(true)
    } else {
      goTo(current + 1)
    }
  }

  const handleConfidence = (confidence: Confidence) => {
    if (blockId && chapterId) {
      recordFlashcardReview(blockId, chapterId, current, confidence)
    }
    next()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); if (!flipped || !hasProgress) next() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
    else if (flipped && hasProgress) {
      if (e.key === '1') handleConfidence('again')
      else if (e.key === '2') handleConfidence('hard')
      else if (e.key === '3') handleConfidence('good')
      else if (e.key === '4') handleConfidence('easy')
    }
  }

  // Get dot colors based on review history
  const getDotColor = (idx: number): string => {
    if (!blockId) return 'var(--ink-faint)'
    const review = getLastReview(blockId, idx)
    if (!review) return 'var(--ink-faint)'
    switch (review.confidence) {
      case 'again': return '#dc2626'
      case 'hard': return '#ea580c'
      case 'good': return '#16a34a'
      case 'easy': return 'var(--chrome-accent)'
      default: return 'var(--ink-faint)'
    }
  }

  // Session complete summary
  if (sessionComplete) {
    const reviewed = cards.length
    return (
      <div style={{ margin: '1.5rem 0' }}>
        <div style={{
          border: '2px solid #16a34a',
          borderRadius: 10,
          padding: '1.5rem',
          textAlign: 'center',
          background: 'rgba(34, 197, 94, 0.06)',
        }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700, color: '#16a34a', marginBottom: 8 }}>
            Session Complete
          </div>
          <div style={{ fontFamily: 'var(--font-body)', color: 'var(--ink-secondary)', marginBottom: 12 }}>
            Reviewed {reviewed} cards
          </div>
          <button
            type="button"
            onClick={() => { setCurrent(0); setFlipped(false); setSessionComplete(false) }}
            style={{
              fontFamily: 'var(--font-ui)', fontSize: '0.8rem', fontWeight: 600,
              color: 'var(--chrome-accent, var(--chrome-accent))', background: 'rgba(47, 92, 138, 0.08)',
              border: '1px solid var(--chrome-accent)', borderRadius: 6,
              padding: '6px 16px', cursor: 'pointer',
            }}
          >
            Review Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ margin: '1.5rem 0' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.75rem',
      }}>
        <span style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.2rem',
          fontWeight: 700,
          color: 'var(--ink-primary)',
        }}>
          Flashcard Review
        </span>
        <span style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '0.75rem',
          color: 'var(--ink-faint)',
          letterSpacing: '0.04em',
        }}>
          {current + 1} / {cards.length}
        </span>
      </div>

      {/* Card area */}
      <div
        tabIndex={0}
        role="region"
        aria-label={`Flashcard ${current + 1} of ${cards.length}. ${flipped ? 'Showing answer' : 'Showing question'}. Space to flip, arrow keys to navigate.`}
        onKeyDown={handleKeyDown}
        onClick={flip}
        style={{
          cursor: 'pointer',
          perspective: '1200px',
          minHeight: '200px',
          position: 'relative',
          outline: 'none',
          borderRadius: '10px',
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${current}-${flipped ? 'back' : 'front'}`}
            initial={{ opacity: 0, x: direction * 30, rotateY: flipped ? -15 : 15 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            exit={{ opacity: 0, x: direction * -30 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{
              border: flipped
                ? '2px solid var(--chrome-accent, var(--chrome-accent))'
                : '2px solid var(--ink-primary)',
              borderRadius: '10px',
              padding: '1.5rem 1.75rem',
              minHeight: '180px',
              display: 'flex',
              flexDirection: 'column',
              background: flipped
                ? 'rgba(47, 92, 138, 0.03)'
                : 'transparent',
            }}
          >
            {/* Category + side label */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}>
              {card.category && (
                <span className="flashcard-category">{card.category}</span>
              )}
              <span className="flashcard-label" style={{ marginLeft: card.category ? '0' : undefined }}>
                {flipped ? 'Answer' : 'Question'}
              </span>
            </div>

            {/* Content */}
            <div style={{
              fontFamily: 'var(--font-body)',
              fontSize: '1.1rem',
              color: 'var(--ink-primary)',
              lineHeight: 1.7,
              flex: 1,
            }}>
              {renderText(flipped ? card.back : card.front)}
            </div>

            {/* Hint */}
            <div className="flashcard-hint" style={{ marginTop: '1.25rem' }}>
              {flipped
                ? (hasProgress ? 'Rate your confidence below' : 'Click or Space to see question')
                : 'Click or Space to reveal answer'}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Confidence buttons (shown when flipped + has progress tracking) */}
      {flipped && hasProgress && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.5rem',
          marginTop: '0.75rem',
        }}>
          {CONFIDENCE_BUTTONS.map(({ key, label, color }) => (
            <button
              key={key}
              type="button"
              onClick={(e) => { e.stopPropagation(); handleConfidence(key) }}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.03em',
                color,
                background: 'transparent',
                border: `1.5px solid ${color}`,
                borderRadius: 6,
                padding: '5px 14px',
                cursor: 'pointer',
                transition: 'background 150ms',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${color}15` }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Navigation (shown when NOT in confidence mode) */}
      {(!flipped || !hasProgress) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          marginTop: '0.75rem',
        }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev() }}
            disabled={current === 0}
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.8rem',
              color: current === 0 ? 'var(--ink-faint)' : 'var(--ink-primary)',
              background: 'none',
              border: '1px solid',
              borderColor: current === 0 ? 'var(--ink-faint)' : 'var(--ink-primary)',
              borderRadius: '6px',
              padding: '0.35rem 1rem',
              cursor: current === 0 ? 'default' : 'pointer',
              opacity: current === 0 ? 0.4 : 1,
              transition: 'opacity 200ms',
            }}
          >
            &larr; Prev
          </button>

          {/* Dot indicators */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {cards.map((_, i) => (
              <button
                type="button"
                key={i}
                onClick={(e) => { e.stopPropagation(); goTo(i) }}
                aria-label={`Go to card ${i + 1}`}
                style={{
                  width: i === current ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  border: 'none',
                  background: i === current
                    ? 'var(--chrome-accent, var(--chrome-accent))'
                    : getDotColor(i),
                  opacity: i === current ? 1 : (getDotColor(i) !== 'var(--ink-faint)' ? 0.7 : 0.4),
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'width 200ms ease, opacity 200ms ease, background 200ms ease',
                }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next() }}
            disabled={current === cards.length - 1}
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.8rem',
              color: current === cards.length - 1 ? 'var(--ink-faint)' : 'var(--ink-primary)',
              background: 'none',
              border: '1px solid',
              borderColor: current === cards.length - 1 ? 'var(--ink-faint)' : 'var(--ink-primary)',
              borderRadius: '6px',
              padding: '0.35rem 1rem',
              cursor: current === cards.length - 1 ? 'default' : 'pointer',
              opacity: current === cards.length - 1 ? 0.4 : 1,
              transition: 'opacity 200ms',
            }}
          >
            Next &rarr;
          </button>
        </div>
      )}

      {/* Print-only: show ALL cards as Q/A pairs */}
      <div className="flashcard-print-all">
        {cards.map((c, i) => (
          <div key={i} className="flashcard-print-card" style={{
            border: '1px solid #ccc',
            borderRadius: '6px',
            padding: '0.75rem 1rem',
            marginBottom: '0.5rem',
            breakInside: 'avoid',
          }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
              {c.category && <span className="flashcard-category">{c.category}</span>}
              <span className="flashcard-label">Card {i + 1}</span>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong style={{ fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Q: </strong>
              <span style={{ fontFamily: 'var(--font-body)', color: 'var(--ink-primary)' }}>{renderText(c.front)}</span>
            </div>
            <div>
              <strong style={{ fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>A: </strong>
              <span style={{ fontFamily: 'var(--font-body)', color: 'var(--ink-secondary)' }}>{renderText(c.back)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
