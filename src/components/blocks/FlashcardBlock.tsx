import { useState } from 'react'
import { motion } from 'framer-motion'
import type { FlashcardBlock as FlashcardBlockType } from '@/types'
import { renderText } from '@/lib/render-text'
import RoughBox from '@/components/shared/RoughBox'

export default function FlashcardBlock({ cards }: FlashcardBlockType) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({})

  if (!cards || cards.length === 0) return null

  const toggleCard = (index: number) => {
    setFlipped((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  return (
    <div className="flashcard-grid">
      {cards.map((card, i) => {
        const isFlipped = flipped[i] ?? false

        return (
          <div
            key={i}
            className="flashcard"
            onClick={() => toggleCard(i)}
          >
            <motion.div
              className={`flashcard-inner${isFlipped ? ' flipped' : ''}`}
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              style={{
                transformStyle: 'preserve-3d',
                minHeight: '160px',
              }}
            >
              {/* Front */}
              <div
                style={{
                  backfaceVisibility: 'hidden',
                  position: 'absolute',
                  inset: 0,
                }}
              >
                <RoughBox
                  seed={i * 17 + 5}
                  stroke="var(--ink-primary)"
                  strokeWidth={1.2}
                  roughness={1.2}
                  padding="1.25rem"
                >
                  {card.category && (
                    <span className="flashcard-category">{card.category}</span>
                  )}
                  <div className="flashcard-label">Question</div>
                  <div
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'var(--ink-primary)',
                      lineHeight: 1.6,
                    }}
                  >
                    {renderText(card.front)}
                  </div>
                  <div className="flashcard-hint">
                    Click to reveal answer
                  </div>
                </RoughBox>
              </div>

              {/* Back */}
              <div
                style={{
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)',
                  position: 'absolute',
                  inset: 0,
                }}
              >
                <RoughBox
                  seed={i * 17 + 50}
                  stroke="var(--chrome-accent, #52FEFE)"
                  strokeWidth={1.2}
                  roughness={1.2}
                  padding="1.25rem"
                >
                  {card.category && (
                    <span className="flashcard-category">{card.category}</span>
                  )}
                  <div className="flashcard-label">Answer</div>
                  <div
                    style={{
                      fontFamily: 'var(--font-body)',
                      color: 'var(--ink-primary)',
                      lineHeight: 1.6,
                    }}
                  >
                    {renderText(card.back)}
                  </div>
                  <div className="flashcard-hint">
                    Click to see question
                  </div>
                </RoughBox>
              </div>
            </motion.div>
          </div>
        )
      })}
    </div>
  )
}
