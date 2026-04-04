import { useState } from 'react'
import type { QuizBlock as QuizBlockType } from '@/types'
import { renderText } from '@/lib/render-text'
import RoughBox from '@/components/shared/RoughBox'

export default function QuizBlock({ questions }: QuizBlockType) {
  const [answers, setAnswers] = useState<Record<string, number>>({})

  if (!questions || questions.length === 0) return null

  const selectAnswer = (questionId: string, optionIndex: number) => {
    if (answers[questionId] !== undefined) return
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }))
  }

  return (
    <div style={{ margin: '1.5rem 0' }}>
      <RoughBox
        seed={201}
        stroke="var(--ink-primary)"
        strokeWidth={1.5}
        roughness={1.0}
        padding="1.25rem 1.5rem"
      >
        <div className="quiz-title">Test Your Understanding</div>

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

                    // Determine visual state
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
                      <RoughBox
                        key={i}
                        seed={q.id.length * 7 + i * 13}
                        stroke={optionStroke}
                        strokeWidth={1}
                        fill={optionFill}
                        fillStyle="solid"
                        roughness={0.8}
                        padding="0"
                      >
                        <button
                          className="quiz-option"
                          onClick={() => selectAnswer(q.id, i)}
                          disabled={hasAnswered}
                          style={{
                            color: textColor,
                            opacity: hasAnswered && !isThisCorrect && !isThisSelected ? 0.5 : 1,
                          }}
                        >
                          <span className="quiz-option-letter">
                            {String.fromCharCode(65 + i)}.
                          </span>
                          {renderText(option)}
                        </button>
                      </RoughBox>
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
      </RoughBox>
    </div>
  )
}
