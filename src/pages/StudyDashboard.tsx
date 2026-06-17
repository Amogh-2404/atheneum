import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Layers, Flame, GraduationCap,
  CheckCircle2, RotateCcw, X, ChevronRight,
} from 'lucide-react'
import { useBook } from '@/hooks/useBook'
import { useLearningProgress } from '@/hooks/useLearningProgress'
import { fetchJSON } from '@/lib/api'
import { renderText } from '@/lib/render-text'
import { spring, tween, pressable } from '@/lib/motion'
import type { Confidence, CardSRSState } from '@/types/learning'
import type { Chapter } from '@/types'
import { SkeletonBlock, ShimmerStyle } from '@/components/shared/Skeleton'
import ErrorState from '@/components/shared/ErrorState'

/* ─── Tokenized score ramp ─────────────────────────────────────────────
   ONE red→orange→green ramp, derived purely from existing semantic hues
   (warning=red, example=green) via color-mix. NEVER cyan, never a raw hex.
   `band` returns low / mid / high so callers stay declarative.
────────────────────────────────────────────────────────────────────── */
const SCORE_LOW = 'var(--callout-warning-border)'   // red
const SCORE_HIGH = 'var(--callout-example-border)'  // green
// orange = the natural midpoint of red→green in sRGB
const SCORE_MID = `color-mix(in srgb, ${SCORE_LOW} 52%, ${SCORE_HIGH} 48%)`

/** Continuous ramp color for a 0–1 fraction — low→mid→high. */
function scoreColor(t: number): string {
  const x = Math.max(0, Math.min(1, t))
  if (x < 0.5) return `color-mix(in srgb, ${SCORE_LOW} ${Math.round((1 - x * 2) * 100)}%, ${SCORE_MID})`
  return `color-mix(in srgb, ${SCORE_HIGH} ${Math.round((x - 0.5) * 2 * 100)}%, ${SCORE_MID})`
}

/* Confidence answers — colored by the SAME ramp, red(again)→green(easy). */
const CONFIDENCE_BUTTONS: { key: Confidence; label: string; t: number }[] = [
  { key: 'again', label: 'Again', t: 0 },
  { key: 'hard', label: 'Hard', t: 0.34 },
  { key: 'good', label: 'Good', t: 0.7 },
  { key: 'easy', label: 'Easy', t: 1 },
]

/* Shared eyebrow label style — Inter 600, tracked uppercase. */
const eyebrow = (color: string): React.CSSProperties => ({
  fontFamily: 'var(--font-ui)',
  fontSize: '0.66rem',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color,
})

const tnum: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1',
}

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

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

  // ─── Derived analytics ───────────────────────────────────────────────

  // 7-day forward "due" forecast (today → +6) from SRS nextReviewAt
  const dueForecast = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfToday + i * 86_400_000)
      return { date: d, label: DAY_LABELS[d.getDay()], count: 0 }
    })
    for (const s of progress?.srs ?? []) {
      const t = new Date(s.nextReviewAt).getTime()
      // anything due in the past OR today lands on day 0
      if (t < startOfToday + 86_400_000) { days[0].count++; continue }
      const idx = Math.floor((t - startOfToday) / 86_400_000)
      if (idx >= 0 && idx < 7) days[idx].count++
    }
    return days
  }, [progress])
  const maxDue = Math.max(1, ...dueForecast.map(d => d.count))

  // Quiz scores across chapters (latest answer per question)
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

  // Per-chapter MASTERY — blend of SRS retention (ease/reps) + quiz accuracy
  const chapterMastery = useMemo(() => {
    if (!progress) return []
    const byChapter = new Map<string, { srsSum: number; srsN: number; quizCorrect: number; quizTotal: number }>()
    const ensure = (id: string) => {
      if (!byChapter.has(id)) byChapter.set(id, { srsSum: 0, srsN: 0, quizCorrect: 0, quizTotal: 0 })
      return byChapter.get(id)!
    }
    // SRS contribution: ease (1.3→3.0) and repetitions both proxy retention
    for (const s of progress.srs) {
      const fp = progress.flashcards[s.blockId]
      if (!fp) continue
      const easeNorm = Math.max(0, Math.min(1, (s.easeFactor - 1.3) / (3.0 - 1.3)))
      const repNorm = Math.min(1, s.repetitions / 4)
      const bucket = ensure(fp.chapterId)
      bucket.srsSum += easeNorm * 0.6 + repNorm * 0.4
      bucket.srsN++
    }
    for (const q of quizScores) {
      const bucket = ensure(q.chapterId)
      bucket.quizCorrect += q.correct
      bucket.quizTotal += q.total
    }
    return Array.from(byChapter.entries()).map(([chapterId, b]) => {
      const srs = b.srsN > 0 ? b.srsSum / b.srsN : null
      const quiz = b.quizTotal > 0 ? b.quizCorrect / b.quizTotal : null
      let mastery: number
      if (srs !== null && quiz !== null) mastery = srs * 0.55 + quiz * 0.45
      else mastery = srs ?? quiz ?? 0
      return { chapterId, mastery, cards: b.srsN }
    }).sort((a, b) => a.mastery - b.mastery) // weakest first — what to study
  }, [progress, quizScores])

  // Quiet streak — consecutive days (ending today/yesterday) with any review
  const streak = useMemo(() => {
    const fc = progress?.flashcards
    if (!fc) return 0
    const dayKeys = new Set<number>()
    for (const blk of Object.values(fc)) {
      for (const r of blk.reviews) {
        const d = new Date(r.timestamp)
        dayKeys.add(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime())
      }
    }
    if (dayKeys.size === 0) return 0
    const now = new Date()
    let cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    // allow the streak to count even if today hasn't been reviewed yet
    if (!dayKeys.has(cursor)) cursor -= 86_400_000
    let count = 0
    while (dayKeys.has(cursor)) { count++; cursor -= 86_400_000 }
    return count
  }, [progress])

  const prettyChapter = (id: string) =>
    id.replace(/^\d+-/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  // ─── Review session ──────────────────────────────────────────────────
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

  // ─── Loading / error ─────────────────────────────────────────────────
  if (bookLoading) return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-bg)', padding: 'var(--space-7) var(--space-5)' }}>
      <ShimmerStyle />
      <div style={{ maxWidth: 720, margin: '0 auto' }}><SkeletonBlock lines={5} /><SkeletonBlock lines={3} /></div>
    </div>
  )

  if (bookError) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-bg)' }}>
      <ErrorState message={bookError} icon="error" onRetry={() => window.location.reload()} />
    </div>
  )

  if (!book) return null

  // ─── Session complete ────────────────────────────────────────────────
  if (sessionResults.length > 0 && !reviewMode) {
    const good = sessionResults.filter(r => r === 'good' || r === 'easy').length
    const frac = good / sessionResults.length
    return (
      <div style={{ minHeight: '100vh', background: 'var(--paper-bg)', padding: 'var(--space-7) var(--space-5)' }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={tween.enter}
          style={{ maxWidth: 460, margin: '0 auto', textAlign: 'center' }}
        >
          <CheckCircle2 size={36} strokeWidth={1.75} color={scoreColor(frac)} style={{ marginBottom: 'var(--space-3)' }} />
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.7rem', fontWeight: 600, color: 'var(--ink-primary)', margin: 0, lineHeight: 1.15 }}>
            Session Complete
          </h1>
          <p style={{ ...tnum, color: 'var(--ink-secondary)', margin: 'var(--space-2) 0 var(--space-5)', fontSize: '0.9rem' }}>
            Reviewed {sessionResults.length} {sessionResults.length === 1 ? 'card' : 'cards'} · {good} rated Good or Easy
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <motion.button {...pressable} type="button"
              onClick={() => { setSessionResults([]); setReviewIdx(0); setReviewMode(true) }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: 44, fontFamily: 'var(--font-ui)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--paper-bg)', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-2)', padding: '0 var(--space-5)', cursor: 'pointer' }}>
              <RotateCcw size={15} strokeWidth={2} /> Review Again
            </motion.button>
            <Link to={`/book/${bookId}`}
              style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontFamily: 'var(--font-ui)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink-secondary)', background: 'transparent', border: 'var(--hairline)', borderRadius: 'var(--radius-2)', padding: '0 var(--space-5)', textDecoration: 'none' }}>
              Back to Book
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  // ─── Review mode ─────────────────────────────────────────────────────
  if (reviewMode && dueCards.length > 0) {
    const card = dueCards[reviewIdx]
    const content = card ? getCardContent(card) : null
    const progressFrac = (reviewIdx + (flipped ? 1 : 0)) / dueCards.length
    return (
      <div style={{ minHeight: '100vh', background: 'var(--paper-bg)', padding: 'var(--space-7) var(--space-5)' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          {/* progress rail */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <span style={{ ...tnum, fontSize: '0.8rem', color: 'var(--ink-secondary)' }}>
              Card {reviewIdx + 1} <span style={{ color: 'var(--ink-faint)' }}>/ {dueCards.length}</span>
            </span>
            <motion.button {...pressable} type="button" onClick={() => setReviewMode(false)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 500, color: 'var(--ink-secondary)', background: 'none', border: 'var(--hairline)', borderRadius: 'var(--radius-1)', padding: '0 var(--space-3)', cursor: 'pointer' }}>
              <X size={13} strokeWidth={2.25} /> Exit
            </motion.button>
          </div>
          <div style={{ height: 3, borderRadius: 'var(--radius-full)', background: 'color-mix(in srgb, var(--ink-faint) 25%, transparent)', overflow: 'hidden', marginBottom: 'var(--space-5)' }}>
            <motion.div animate={{ width: `${progressFrac * 100}%` }} transition={spring.default}
              style={{ height: '100%', borderRadius: 'var(--radius-full)', background: 'var(--accent)' }} />
          </div>

          {/* card */}
          <motion.div
            key={reviewIdx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={tween.enter}
            onClick={() => setFlipped(f => !f)} role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFlipped(f => !f) } }}
            style={{ cursor: 'pointer', border: `1px solid ${flipped ? 'var(--accent)' : 'var(--chrome-border)'}`, borderRadius: 'var(--radius-3)', padding: 'var(--space-6)', minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: flipped ? 'color-mix(in srgb, var(--accent) 4%, var(--paper-bg))' : 'var(--paper-bg)', boxShadow: 'var(--shadow-1)', transition: 'border-color 200ms, background 200ms' }}>
            <div style={{ ...eyebrow(flipped ? 'var(--accent)' : 'var(--ink-faint)'), marginBottom: 'var(--space-3)' }}>
              {flipped ? 'Answer' : 'Question'}
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '1.1rem', color: 'var(--ink-primary)', lineHeight: 1.7 }}>
              {content ? renderText(flipped ? content.back : content.front) : 'Loading…'}
            </div>
          </motion.div>

          {flipped ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
              {CONFIDENCE_BUTTONS.map(({ key, label, t }) => {
                const c = scoreColor(t)
                return (
                  <motion.button {...pressable} key={key} type="button" onClick={() => handleConfidence(key)}
                    style={{ minHeight: 48, fontFamily: 'var(--font-ui)', fontSize: '0.85rem', fontWeight: 600, color: c, background: `color-mix(in srgb, ${c} 7%, var(--paper-bg))`, border: `1px solid ${c}`, borderRadius: 'var(--radius-2)', cursor: 'pointer' }}>
                    {label}
                  </motion.button>
                )
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginTop: 'var(--space-3)', ...eyebrow('var(--ink-faint)'), letterSpacing: '0.06em' }}>
              Tap to reveal answer
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Dashboard view ──────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-bg)', padding: 'var(--space-6) var(--space-4)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-6)', paddingBottom: 'var(--space-4)', borderBottom: 'var(--hairline)' }}>
          <div style={{ minWidth: 0 }}>
            <Link to={`/book/${bookId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...eyebrow('var(--ink-faint)'), textDecoration: 'none' }}>
              <ArrowLeft size={12} strokeWidth={2.25} /> {book.title}
            </Link>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.9rem, 6vw, 2.4rem)', fontWeight: 600, color: 'var(--ink-primary)', margin: 'var(--space-1) 0 0', lineHeight: 1.1, letterSpacing: '-0.01em' }}>
              Study
            </h1>
          </div>
          {streak > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...tnum, fontSize: '0.85rem', fontWeight: 600, color: 'var(--ink-secondary)' }}
              title={`${streak}-day review streak`}>
              <Flame size={15} strokeWidth={2} color={scoreColor(Math.min(1, streak / 14))} />
              {streak} day{streak === 1 ? '' : 's'}
            </div>
          )}
        </header>

        {/* Due forecast + Start review */}
        <section style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-5)', borderRadius: 'var(--radius-3)', border: 'var(--hairline)', background: 'var(--chrome-surface, color-mix(in srgb, var(--ink-faint) 4%, var(--paper-bg)))', boxShadow: 'var(--shadow-1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...eyebrow('var(--accent)') }}>
              <Layers size={14} strokeWidth={2} /> Due this week
            </div>
            <span style={{ ...tnum, fontSize: '1.5rem', fontWeight: 700, color: dueCards.length > 0 ? 'var(--accent)' : 'var(--ink-faint)', lineHeight: 1 }}>
              {dueCards.length}
            </span>
          </div>

          {/* 7-day sparkline / bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--space-2)', alignItems: 'end', height: 64, marginBottom: 'var(--space-2)' }}>
            {dueForecast.map((d, i) => {
              const h = d.count === 0 ? 3 : Math.max(8, Math.round((d.count / maxDue) * 56))
              const today = i === 0
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', height: '100%' }}>
                  <span style={{ ...tnum, fontSize: '0.62rem', fontWeight: 600, color: d.count > 0 ? 'var(--ink-secondary)' : 'transparent', marginBottom: 4, lineHeight: 1 }}>
                    {d.count}
                  </span>
                  <motion.div
                    initial={{ height: 3 }} animate={{ height: h }} transition={{ ...spring.default, delay: i * 0.02 }}
                    style={{
                      width: '100%', borderRadius: 'var(--radius-1)',
                      background: today
                        ? 'var(--accent)'
                        : d.count > 0
                          ? 'color-mix(in srgb, var(--accent) 38%, transparent)'
                          : 'color-mix(in srgb, var(--ink-faint) 18%, transparent)',
                    }}
                  />
                </div>
              )
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 'var(--space-2)', marginBottom: dueCards.length > 0 ? 'var(--space-4)' : 0 }}>
            {dueForecast.map((d, i) => (
              <span key={i} style={{ textAlign: 'center', ...eyebrow(i === 0 ? 'var(--accent)' : 'var(--ink-faint)'), fontSize: '0.6rem', letterSpacing: '0.04em' }}>
                {i === 0 ? 'Now' : d.label}
              </span>
            ))}
          </div>

          {dueCards.length > 0 ? (
            <motion.button {...pressable} type="button"
              onClick={() => { setReviewMode(true); setReviewIdx(0); setFlipped(false); setSessionResults([]) }}
              style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, fontFamily: 'var(--font-ui)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--paper-bg)', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-2)', cursor: 'pointer' }}>
              Start Review <ArrowRight size={16} strokeWidth={2.25} />
            </motion.button>
          ) : (
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.88rem', color: 'var(--ink-faint)', margin: 0, textAlign: 'center' }}>
              Nothing due. The schedule is clear — check back later.
            </p>
          )}
        </section>

        {/* Per-chapter mastery */}
        {chapterMastery.length > 0 && (
          <section style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...eyebrow('var(--ink-secondary)') }}>
                <GraduationCap size={14} strokeWidth={2} /> Mastery
              </div>
              {overallScore !== null && (
                <span style={{ ...tnum, fontSize: '0.85rem', fontWeight: 700, color: scoreColor(overallScore / 100) }}>
                  {overallScore}%
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {chapterMastery.map(c => {
                const col = scoreColor(c.mastery)
                return (
                  <Link key={c.chapterId} to={`/book/${bookId}/chapter/${c.chapterId}`}
                    style={{ display: 'block', textDecoration: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 6 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-ui)', fontSize: '0.82rem', fontWeight: 500, color: 'var(--ink-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {prettyChapter(c.chapterId)}
                        <ChevronRight size={13} strokeWidth={2} color="var(--ink-faint)" style={{ flexShrink: 0 }} />
                      </span>
                      <span style={{ ...tnum, fontSize: '0.8rem', fontWeight: 700, color: col, flexShrink: 0 }}>
                        {Math.round(c.mastery * 100)}%
                      </span>
                    </div>
                    <div style={{ height: 6, borderRadius: 'var(--radius-full)', background: 'color-mix(in srgb, var(--ink-faint) 16%, transparent)', overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }} whileInView={{ width: `${Math.max(2, c.mastery * 100)}%` }}
                        viewport={{ once: true }} transition={spring.default}
                        style={{ height: '100%', borderRadius: 'var(--radius-full)', background: col }} />
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {dueCards.length === 0 && chapterMastery.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
            <Layers size={28} strokeWidth={1.5} color="var(--ink-faint)" style={{ marginBottom: 'var(--space-3)' }} />
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: 'var(--ink-faint)', maxWidth: 360, margin: '0 auto', lineHeight: 1.6 }}>
              No study data yet. Answer quizzes and review flashcards inside chapters to build your record.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
