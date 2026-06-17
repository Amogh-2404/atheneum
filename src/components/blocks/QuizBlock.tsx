import { useState, useCallback, useMemo } from 'react'
import type { QuizBlock as QuizBlockType } from '@/types'
import { renderText } from '@/lib/render-text'
import { useLearningProgress } from '@/hooks/useLearningProgress'

interface QuizBlockProps extends QuizBlockType {
  bookId?: string
  chapterId?: string
}

export default function QuizBlock({ id: blockId, questions, bookId, chapterId }: QuizBlockProps) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const { recordQuizAnswer, getQuizScore, resetQuiz } = useLearningProgress(bookId)

  const prevScore = useMemo(() => blockId ? getQuizScore(blockId) : null, [blockId, getQuizScore])

  if (!questions || questions.length === 0) return null

  const selectAnswer = (questionId: string, optionIndex: number) => {
    if (answers[questionId] !== undefined) return
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }))

    // Persist to learning progress
    if (blockId && chapterId) {
      const correct = questions.find(q => q.id === questionId)?.correctIndex === optionIndex
      recordQuizAnswer(blockId, chapterId, questionId, optionIndex, correct)
    }
  }

  const handleRetake = useCallback(() => {
    if (blockId) resetQuiz(blockId)
    setAnswers({})
  }, [blockId, resetQuiz])

  // Check if all questions answered
  const allAnswered = questions.every(q => answers[q.id] !== undefined)
  const currentCorrect = allAnswered
    ? questions.filter(q => answers[q.id] === q.correctIndex).length
    : 0

  return (
    <div style={{ margin: '1.5rem 0' }}>
      <div
        style={{
          border: '1.5px solid var(--ink-primary)',
          borderRadius: '8px',
          padding: '1.25rem 1.5rem',
        }}
      >
        <div className="quiz-title">Test Your Understanding</div>

        {/* Previous score banner */}
        {prevScore && Object.keys(answers).length === 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.75rem',
            marginBottom: '1rem',
            borderRadius: 6,
            background: 'rgba(47, 92, 138, 0.06)',
            border: '1px solid var(--chrome-border, #1e293b)',
          }}>
            <span style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.8rem',
              color: 'var(--ink-secondary)',
            }}>
              Previous score: <strong style={{ color: 'var(--chrome-accent, var(--chrome-accent))' }}>{prevScore.correct}/{prevScore.total}</strong>
            </span>
            <button
              type="button"
              onClick={handleRetake}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--chrome-accent, var(--chrome-accent))',
                background: 'none',
                border: '1px solid var(--chrome-accent, var(--chrome-accent))',
                borderRadius: 4,
                padding: '3px 10px',
                cursor: 'pointer',
                letterSpacing: '0.03em',
              }}
            >
              Retake
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {questions.map((q) => {
            const selected = answers[q.id]
            const hasAnswered = selected !== undefined
            const isCorrect = selected === q.correctIndex

            return (
              <div key={q.id}>
                {/* Question */}
                <div className="quiz-question">
                  {renderText(q.question)}
                </div>

                {/* Options */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {q.options.map((option, i) => {
                    const isThisCorrect = i === q.correctIndex
                    const isThisSelected = i === selected

                    let optionStroke = 'var(--ink-faint)'
                    let optionFill: string | undefined
                    let textColor = 'var(--ink-primary)'

                    if (hasAnswered) {
                      if (isThisCorrect) {
                        optionStroke = '#16a34a'
                        optionFill = 'rgba(34, 197, 94, 0.08)'
                        textColor = '#166534'
                      } else if (isThisSelected) {
                        optionStroke = '#dc2626'
                        optionFill = 'rgba(239, 68, 68, 0.08)'
                        textColor = '#991b1b'
                      }
                    }

                    return (
                      <button
                        key={i}
                        type="button"
                        className="quiz-option"
                        onClick={() => selectAnswer(q.id, i)}
                        disabled={hasAnswered}
                        style={{
                          color: textColor,
                          opacity: hasAnswered && !isThisCorrect && !isThisSelected ? 0.5 : 1,
                          border: `1.5px solid ${optionStroke}`,
                          borderRadius: '6px',
                          background: optionFill || 'transparent',
                          transition: 'border-color 200ms, background 200ms, opacity 200ms',
                        }}
                      >
                        <span className="quiz-option-letter">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        {renderText(option)}
                      </button>
                    )
                  })}
                </div>

                {/* Result + Explanation */}
                {hasAnswered && (
                  <div
                    className={`quiz-result ${isCorrect ? 'quiz-result-correct' : 'quiz-result-wrong'}`}
                  >
                    <span style={{ fontWeight: 600 }}>
                      {isCorrect ? 'Correct!' : 'Incorrect.'}
                    </span>{' '}
                    {renderText(q.explanation)}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Score summary after all answered */}
        {allAnswered && (
          <div style={{
            marginTop: '1.25rem',
            padding: '0.75rem 1rem',
            borderRadius: 6,
            background: currentCorrect === questions.length
              ? 'rgba(34, 197, 94, 0.08)'
              : 'rgba(47, 92, 138, 0.06)',
            border: `1px solid ${currentCorrect === questions.length ? '#16a34a' : 'var(--chrome-border, #1e293b)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: currentCorrect === questions.length ? '#16a34a' : 'var(--ink-primary)',
            }}>
              Score: {currentCorrect}/{questions.length}
              {currentCorrect === questions.length && ' — Perfect!'}
            </span>
            <button
              type="button"
              onClick={handleRetake}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--ink-secondary)',
                background: 'none',
                border: '1px solid var(--ink-faint)',
                borderRadius: 4,
                padding: '3px 10px',
                cursor: 'pointer',
              }}
            >
              Retake
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
