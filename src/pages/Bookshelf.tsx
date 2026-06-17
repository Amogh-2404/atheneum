import { useMemo, useState, useEffect, useCallback } from 'react'
import type { ComponentType } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useBooks } from '@/hooks/useBooks'
import { spring } from '@/lib/motion'
import { useKeyboard } from '@/hooks/useKeyboard'
import {
  BookOpen,
  Zap,
  Landmark,
  TrendingUp,
  Microscope,
  Layers,
  Cpu,
  Sun,
  Moon,
  Coffee,
  MoreHorizontal,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import type { BookSummary } from '@/types/book'

/* ─── Theme Hook ─────────────────────────────────────────────────── */

type AppTheme = 'light' | 'dark' | 'sepia'

function useAppTheme(): AppTheme {
  const read = useCallback((): AppTheme => {
    const attr = document.documentElement.getAttribute('data-theme')
    if (attr === 'dark' || attr === 'sepia') return attr
    const stored = localStorage.getItem('atheneum-theme')
    if (stored === 'dark' || stored === 'sepia') return stored
    return 'light'
  }, [])

  const [theme, setTheme] = useState<AppTheme>(read)

  useEffect(() => {
    const sync = () => setTheme(read())
    // The app fires a synthetic 'storage' event on theme change
    window.addEventListener('storage', sync)
    // Also observe data-theme attribute mutations on <html>
    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'data-theme') { sync(); break }
      }
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => { window.removeEventListener('storage', sync); obs.disconnect() }
  }, [read])

  return theme
}

/* ─── Cover Style — one type-forward template, tokenized ─────────── */
/**
 * The redesigned cover is a single editorial template across all three
 * themes: a calm muted identity band, a Fraunces title, a hairline rule,
 * an Inter eyebrow micro-label, and a monochrome-tinted Lucide icon.
 * No neon / circuit / scanline / leather / damask / vignette treatments,
 * no per-theme skeuomorphism — the only thing that varies by theme is the
 * surface/ink token set, which already lives in notebook.css.
 */
interface CoverStyle {
  /** Cover paper surface (sits on the card) */
  surface: string
  /** Title ink */
  titleColor: string
  /** Eyebrow micro-label ink */
  eyebrowColor: string
  /** Hairline rule + frame */
  hairline: string
  /** Chapter badge surface / ink */
  badgeBg: string
  badgeBorder: string
  badgeText: string
  /** Monochrome tint applied to the Lucide icon */
  iconColor: string
}

function getCoverStyle(theme: AppTheme): CoverStyle {
  switch (theme) {
    case 'dark':
      return {
        surface: 'var(--chrome-surface)',
        titleColor: 'var(--ink-primary)',
        eyebrowColor: 'var(--ink-faint)',
        hairline: 'var(--hairline-color)',
        badgeBg: 'rgba(255,255,255,0.04)',
        badgeBorder: 'var(--hairline-color)',
        badgeText: 'var(--ink-secondary)',
        iconColor: 'var(--ink-secondary)',
      }
    case 'sepia':
      return {
        surface: 'color-mix(in srgb, var(--paper-bg) 92%, #000)',
        titleColor: 'var(--ink-primary)',
        eyebrowColor: 'var(--ink-faint)',
        hairline: 'var(--hairline-color)',
        badgeBg: 'color-mix(in srgb, var(--paper-bg) 60%, transparent)',
        badgeBorder: 'var(--hairline-color)',
        badgeText: 'var(--ink-secondary)',
        iconColor: 'var(--ink-secondary)',
      }
    default: // light
      return {
        surface: 'color-mix(in srgb, var(--paper-bg) 96%, #000)',
        titleColor: 'var(--ink-primary)',
        eyebrowColor: 'var(--ink-faint)',
        hairline: 'var(--hairline-color)',
        badgeBg: 'color-mix(in srgb, var(--ink-primary) 5%, transparent)',
        badgeBorder: 'var(--hairline-color)',
        badgeText: 'var(--ink-secondary)',
        iconColor: 'var(--ink-secondary)',
      }
  }
}

/* ─── Icon mapping — emoji → Lucide (no emoji ever rendered) ──────── */

const COVER_ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  '⚡': Zap,
  '🏛️': Landmark,
  '🏛': Landmark,
  '📈': TrendingUp,
  '🔬': Microscope,
  '🧱': Layers,
  '🖥️': Cpu,
  '🖥': Cpu,
  '💻': Cpu,
  '📚': BookOpen,
  '📖': BookOpen,
}

/** Resolve a stored emoji coverIcon to a Lucide component (BookOpen fallback). */
function resolveCoverIcon(coverIcon?: string): ComponentType<LucideProps> {
  if (coverIcon && COVER_ICON_MAP[coverIcon]) return COVER_ICON_MAP[coverIcon]
  return BookOpen
}

/* ─── Theme-Specific Page Colors ─────────────────────────────────── */

interface PageThemeStyle {
  pageBg: string
  titleColor: string
  subtitleColor: string
  textColor: string
  cardBg: string
  cardBorder: string
  cardHoverBorder: string
  cardHoverGlow: string
  accentColor: string
  bookInfoBg: string
  bookInfoSubtitle: string
  bookInfoDesc: string
  bookInfoMeta: string
}

/**
 * Page chrome is fully tokenized — every theme draws from the same ink/paper
 * token set, so there is exactly ONE accent (var(--accent)) and zero raw hex.
 * The per-theme switch is kept only for the two cases (card surface, hairline)
 * that legitimately differ, both resolved through tokens.
 */
function getPageThemeStyle(theme: AppTheme): PageThemeStyle {
  const shared = {
    pageBg: 'var(--paper-bg)',
    titleColor: 'var(--ink-primary)',
    subtitleColor: 'var(--ink-secondary)',
    textColor: 'var(--ink-primary)',
    cardBorder: 'var(--hairline-color)',
    cardHoverBorder: 'var(--hairline-color)',
    cardHoverGlow: 'var(--shadow-3)',
    accentColor: 'var(--accent)',
    bookInfoSubtitle: 'var(--ink-secondary)',
    bookInfoDesc: 'var(--ink-secondary)',
    bookInfoMeta: 'var(--ink-faint)',
  } as const

  switch (theme) {
    case 'dark':
      return { ...shared, cardBg: 'var(--chrome-surface)', bookInfoBg: 'var(--chrome-surface)' }
    case 'sepia':
      return {
        ...shared,
        cardBg: 'color-mix(in srgb, var(--paper-bg) 94%, #000)',
        bookInfoBg: 'color-mix(in srgb, var(--paper-bg) 94%, #000)',
      }
    default: // light
      return {
        ...shared,
        cardBg: 'color-mix(in srgb, var(--paper-bg) 98%, #fff)',
        bookInfoBg: 'color-mix(in srgb, var(--paper-bg) 98%, #fff)',
      }
  }
}

/* ─── Last-Read Data ──────────────────────────────────────────────── */

interface LastRead {
  bookId: string
  chapterId: string
  scrollPercent: number
  timestamp: string
}

function getLastRead(): LastRead | null {
  try {
    const raw = localStorage.getItem('atheneum-last-read')
    if (!raw) return null
    const data = JSON.parse(raw) as LastRead
    // Expire after 30 days
    const age = Date.now() - new Date(data.timestamp).getTime()
    if (age > 30 * 24 * 60 * 60 * 1000) return null
    return data
  } catch {
    return null
  }
}

/* ─── Continue Reading Card ───────────────────────────────────────── */

function ContinueReadingCard({
  lastRead,
  books,
  theme,
}: {
  lastRead: LastRead
  books: BookSummary[]
  theme: AppTheme
}) {
  const book = books.find((b) => b.id === lastRead.bookId)
  if (!book) return null
  const ps = getPageThemeStyle(theme)

  const percent = Math.round(lastRead.scrollPercent * 100)
  // BookSummary doesn't include chapters — format the ID nicely
  // IDs are like "03-block-types" → "Block Types"
  const formatChapterId = (id: string) => {
    const slug = id.replace(/^\d+-/, '')  // strip "03-" prefix
    return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
  const chapterLabel = formatChapterId(lastRead.chapterId)

  // Time ago helper
  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    const days = Math.floor(seconds / 86400)
    return days === 1 ? 'yesterday' : `${days}d ago`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      style={{ marginBottom: '2rem' }}
    >
      <Link
        to={`/book/${lastRead.bookId}/${lastRead.chapterId}`}
        style={{ textDecoration: 'none', display: 'block' }}
      >
        <div
          style={{
            background: ps.cardBg,
            border: `var(--hairline)`,
            borderRadius: 'var(--radius-3)',
            padding: 'clamp(var(--space-3), 2vw, var(--space-5)) clamp(var(--space-4), 2.5vw, var(--space-5))',
            boxShadow: 'var(--shadow-1)',
            transition:
              'box-shadow var(--duration-base) var(--ease-standard), transform var(--duration-base) var(--ease-standard)',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget
            el.style.boxShadow = 'var(--shadow-3)'
            el.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget
            el.style.boxShadow = 'var(--shadow-1)'
            el.style.transform = 'translateY(0)'
          }}
        >
          {/* Eyebrow micro-label */}
          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.7rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: ps.accentColor,
              margin: '0 0 var(--space-2) 0',
            }}
          >
            Continue Reading
          </p>

          {/* Book + Chapter */}
          <p
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.15rem',
              fontWeight: 600,
              color: ps.textColor,
              margin: '0 0 var(--space-1) 0',
              lineHeight: 1.2,
            }}
          >
            {book.title}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.8rem',
              color: ps.subtitleColor,
              margin: '0 0 var(--space-3) 0',
            }}
          >
            {chapterLabel}
            {lastRead.timestamp && (
              <span style={{ marginLeft: 8, fontSize: '0.7rem', opacity: 0.6 }}>
                {timeAgo(lastRead.timestamp)}
              </span>
            )}
          </p>

          {/* Thin accent progress bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
            }}
          >
            <div
              style={{
                flex: 1,
                height: 3,
                borderRadius: 'var(--radius-full)',
                background: 'var(--hairline-color)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${percent}%`,
                  background: ps.accentColor,
                  borderRadius: 'var(--radius-full)',
                  transition: 'width var(--duration-slow) var(--ease-standard)',
                }}
              />
            </div>
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.7rem',
                color: ps.subtitleColor,
                letterSpacing: '0.02em',
                flexShrink: 0,
              }}
            >
              {percent}%
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'var(--font-ui)',
                fontSize: '0.8rem',
                color: ps.accentColor,
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              Resume <ArrowRight size={14} strokeWidth={2} aria-hidden />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

/* ─── Book Cover — one type-forward editorial template ───────────── */

/**
 * Stable identity hue per title, golden-ratio spaced so neighbours land far
 * apart on the wheel. Used ONLY for the single calm muted spine band — never
 * for a saturated gradient or a neon stroke.
 */
function coverIdentityHue(seed: number): number {
  // 0.618… is the golden conjugate — successive multiples scatter evenly.
  return Math.round(((seed * 0.61803398875) % 1) * 360)
}

/**
 * A SINGLE calm muted band colour for the book's identity. The raw saturated
 * coverColor/hue is deliberately desaturated to HSL sat ~38-48% so the band
 * reads as a quiet editorial spine, not a poster gradient. Lightness is
 * theme-aware so the band sits comfortably on paper vs. warm-charcoal.
 */
function mutedBandColor(seed: number, theme: AppTheme): string {
  const hue = coverIdentityHue(seed)
  const sat = 43 // squarely inside the 38-48% calm band
  const lightness = theme === 'dark' ? 52 : theme === 'sepia' ? 46 : 56
  return `hsl(${hue}, ${sat}%, ${lightness}%)`
}

function BookCover({
  title,
  coverIcon,
  chapterCount,
  theme,
}: {
  title: string
  coverColor: string
  coverIcon?: string
  chapterCount: number
  tags: string[]
  theme: AppTheme
}) {
  const cs = getCoverStyle(theme)
  const seed = hashSeed(title)
  const band = mutedBandColor(seed, theme)
  const Icon = resolveCoverIcon(coverIcon)

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '3 / 4',
        borderRadius: 'var(--radius-3) var(--radius-3) 0 0',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: cs.surface,
        transition: 'background var(--duration-slow) var(--ease-standard)',
      }}
    >
      {/* ── Identity spine: one calm muted band on the left edge ─── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 6,
          background: band,
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* ── Chapter count badge — Lucide icon, no emoji ─────────── */}
      <div
        style={{
          position: 'absolute',
          top: 'var(--space-4)',
          right: 'var(--space-4)',
          zIndex: 3,
          background: cs.badgeBg,
          border: `1px solid ${cs.badgeBorder}`,
          borderRadius: 'var(--radius-full)',
          padding: '2px var(--space-2)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <BookOpen size={11} strokeWidth={2} color={cs.badgeText} aria-hidden />
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.62rem',
            fontWeight: 600,
            color: cs.badgeText,
            letterSpacing: '0.03em',
          }}
        >
          {chapterCount}
        </span>
      </div>

      {/* ── Main content — icon, title, hairline rule, eyebrow ──── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: 'var(--space-6) var(--space-5) var(--space-5) var(--space-5)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Small monochrome-tinted Lucide icon */}
        <Icon
          size={26}
          strokeWidth={1.6}
          color={cs.iconColor}
          style={{ marginBottom: 'var(--space-4)' }}
          aria-hidden
        />

        {/* Title — Fraunces, the centrepiece */}
        <h3
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(1.6rem, 4vw, 1.85rem)',
            fontWeight: 600,
            color: cs.titleColor,
            margin: 0,
            lineHeight: 1.18,
            textAlign: 'left',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h3>

        {/* Hairline rule */}
        <div
          style={{
            width: 40,
            height: 1,
            background: cs.hairline,
            margin: 'var(--space-3) 0',
          }}
        />

        {/* Eyebrow micro-label — Inter, uppercase (eyebrow only) */}
        <p
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.62rem',
            fontWeight: 600,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: cs.eyebrowColor,
            margin: 0,
          }}
        >
          Atheneum
        </p>
      </div>
    </div>
  )
}

/* ─── Book Card ───────────────────────────────────────────────────── */

function BookCard({
  book,
  index,
  theme,
  onArchive,
  onDelete,
}: {
  book: BookSummary
  index: number
  theme: AppTheme
  onArchive?: (bookId: string) => void
  onDelete?: (bookId: string) => void
}) {
  const ps = getPageThemeStyle(theme)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <motion.div
      className="book-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: spring.default }}
      whileTap={{ scale: 0.985, transition: spring.press }}
      transition={{
        duration: 0.35,
        delay: index * 0.08,
        ease: 'easeOut',
      }}
      style={{ position: 'relative' }}
      onMouseLeave={() => { setMenuOpen(false); setConfirmDelete(false) }}
    >
      {/* Context menu button — 44px touch target */}
      {(onArchive || onDelete) && (
        <button
          type="button"
          aria-label="Book options"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen); setConfirmDelete(false) }}
          style={{
            position: 'absolute',
            top: 'var(--space-1)',
            right: 'var(--space-1)',
            zIndex: 10,
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-full)',
            background: 'var(--chrome-glass)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity var(--duration-base) var(--ease-standard)',
            color: 'var(--chrome-hover-text)',
          }}
          className="book-card-menu-btn"
        >
          <MoreHorizontal size={18} strokeWidth={2} aria-hidden />
        </button>
      )}

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'var(--space-7)',
            right: 'var(--space-2)',
            zIndex: 20,
            background: 'var(--chrome-surface)',
            border: 'var(--hairline)',
            borderRadius: 'var(--radius-2)',
            padding: 'var(--space-1) 0',
            minWidth: 140,
            boxShadow: 'var(--shadow-3)',
          }}
          onClick={(e) => e.preventDefault()}
        >
          {!confirmDelete ? (
            <>
              {onArchive && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onArchive(book.id); setMenuOpen(false) }}
                  style={{
                    display: 'block', width: '100%', minHeight: 44, padding: 'var(--space-2) var(--space-4)', border: 'none',
                    background: 'none', color: 'var(--chrome-text)', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'var(--font-ui)', fontSize: '0.82rem',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--chrome-hover-text)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--chrome-text)' }}
                >
                  Archive
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
                  style={{
                    display: 'block', width: '100%', minHeight: 44, padding: 'var(--space-2) var(--space-4)', border: 'none',
                    background: 'none', color: 'var(--color-error, #f87171)', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'var(--font-ui)', fontSize: '0.82rem',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.7' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                >
                  Delete
                </button>
              )}
            </>
          ) : (
            <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-error, #fca5a5)', margin: '0 0 var(--space-2) 0', lineHeight: 1.4, fontFamily: 'var(--font-ui)' }}>
                Delete "{book.title}"? This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete!(book.id); setMenuOpen(false); setConfirmDelete(false) }}
                  style={{
                    flex: 1, minHeight: 44, padding: 'var(--space-2)', border: 'none', borderRadius: 'var(--radius-1)',
                    background: 'var(--color-error, #dc2626)', color: '#fff', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 600,
                  }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}
                  style={{
                    flex: 1, minHeight: 44, padding: 'var(--space-2)', border: 'var(--hairline)',
                    borderRadius: 'var(--radius-1)', background: 'none', color: 'var(--chrome-text)', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)', fontSize: '0.75rem',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <Link
        to={`/book/${book.id}`}
        style={{ textDecoration: 'none', display: 'block' }}
      >
          <div
            style={{
              background: ps.bookInfoBg,
              border: 'var(--hairline)',
              borderRadius: 'var(--radius-3)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-1)',
              transition:
                'transform var(--duration-base) var(--ease-standard), box-shadow var(--duration-base) var(--ease-standard)',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.transform = 'translateY(-2px)'
              el.style.boxShadow = 'var(--shadow-3)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.transform = 'translateY(0)'
              el.style.boxShadow = 'var(--shadow-1)'
            }}
          >
            {/* Generated cover */}
            <BookCover
              title={book.title}
              coverColor={book.coverColor}
              coverIcon={book.coverIcon}
              chapterCount={book.chapterCount}
              tags={book.tags}
              theme={theme}
            />

            {/* Info section — theme-aware colors */}
            <div style={{ padding: '0.85rem 1.25rem 1.1rem' }}>
              {/* Subtitle */}
              {book.subtitle && (
                <p
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.82rem',
                    color: ps.bookInfoSubtitle,
                    margin: '0 0 0.4rem 0',
                    fontWeight: 500,
                  }}
                >
                  {book.subtitle}
                </p>
              )}

              {/* Description — clamped to 3 lines */}
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.82rem',
                  lineHeight: 1.6,
                  color: ps.bookInfoDesc,
                  margin: '0 0 0.5rem 0',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {book.description}
              </p>

              {/* Chapter count */}
              <p
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.68rem',
                  color: ps.bookInfoMeta,
                  margin: 0,
                  letterSpacing: '0.03em',
                }}
              >
                {(() => {
                  // Read progress from localStorage
                  let readCount = 0
                  try {
                    const progress = JSON.parse(localStorage.getItem(`atheneum-progress-${book.id}`) || '{}')
                    readCount = Object.keys(progress).length
                  } catch { /* ignore */ }
                  const total = book.chapterCount || 0
                  return readCount > 0
                    ? `${readCount}/${total} chapters read`
                    : `${total} ${total === 1 ? 'chapter' : 'chapters'}`
                })()}
              </p>
              {/* Reading progress bar */}
              {(() => {
                let readCount = 0
                try {
                  const progress = JSON.parse(localStorage.getItem(`atheneum-progress-${book.id}`) || '{}')
                  readCount = Object.keys(progress).length
                } catch { /* ignore */ }
                const total = book.chapterCount || 1
                const pct = Math.round((readCount / total) * 100)
                if (readCount === 0) return null
                return (
                  <div style={{
                    width: '100%',
                    height: 3,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--hairline-color)',
                    marginTop: 'var(--space-2)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      borderRadius: 'var(--radius-full)',
                      background: pct === 100 ? 'var(--color-success, #16a34a)' : 'var(--accent)',
                      transition: 'width var(--duration-slow) var(--ease-standard)',
                    }} />
                  </div>
                )
              })()}
            </div>
          </div>
      </Link>
    </motion.div>
  )
}

/* ─── Spinner ─────────────────────────────────────────────────────── */

/* ─── Archived Books Section ──────────────────────────────────────── */

function ArchivedSection({ books, theme, onChange }: { books: BookSummary[]; theme: AppTheme; onChange: () => void | Promise<void> }) {
  const [expanded, setExpanded] = useState(false)
  const ps = getPageThemeStyle(theme)

  return (
    <div style={{ marginTop: '3rem' }}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
          fontSize: '0.82rem',
          color: ps.bookInfoMeta,
          letterSpacing: '0.04em',
          padding: '8px 0',
        }}
      >
        <span style={{
          display: 'inline-block',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 200ms ease',
          fontSize: '0.7rem',
        }}>&#9654;</span>
        Archived ({books.length})
      </button>

      {expanded && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.75rem',
            marginTop: '1rem',
            opacity: 0.6,
          }}
        >
          {books.map((book, i) => (
            <div key={book.id} style={{ position: 'relative' }}>
              {/* Unarchive button */}
              <button
                type="button"
                onClick={async () => {
                  try {
                    await fetch(`/api/books/${book.id}/unarchive`, { method: 'POST' })
                    await onChange()
                  } catch { /* ignore */ }
                }}
                style={{
                  position: 'absolute',
                  top: 'var(--space-2)',
                  right: 'var(--space-2)',
                  zIndex: 10,
                  minHeight: 44,
                  padding: 'var(--space-2) var(--space-4)',
                  borderRadius: 'var(--radius-2)',
                  background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  transition: 'background var(--duration-base) var(--ease-standard), border-color var(--duration-base) var(--ease-standard)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 20%, transparent)'
                  e.currentTarget.style.borderColor = 'var(--accent)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 12%, transparent)'
                  e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 30%, transparent)'
                }}
              >
                Unarchive
              </button>

              <BookCard
                book={book}
                index={i}
                theme={theme}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Skeleton Loading State ──────────────────────────────────────── */

import { SkeletonBookCard, ShimmerStyle } from '@/components/shared/Skeleton'
import ErrorState from '@/components/shared/ErrorState'

function BookshelfSkeleton() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-bg)', padding: '3rem 2rem' }}>
      <ShimmerStyle />
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24, marginTop: 48 }}>
          {Array.from({ length: 6 }, (_, i) => <SkeletonBookCard key={i} />)}
        </div>
      </div>
    </div>
  )
}

/* ─── Empty State ─────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'var(--paper-bg)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.4rem',
          color: 'var(--ink-secondary)',
          textAlign: 'center',
          maxWidth: 420,
          lineHeight: 1.5,
        }}
      >
        The shelves are empty... Start a conversation with Claude to
        create your first book.
      </p>
    </div>
  )
}

/* ─── Utility ─────────────────────────────────────────────────────── */

/** Deterministic seed from a string — keeps RoughBox strokes stable */
function hashSeed(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/* ─── Bookshelf ───────────────────────────────────────────────────── */

export default function Bookshelf() {
  const { books, loading, error, refetch } = useBooks()
  const navigate = useNavigate()
  const lastRead = useMemo(getLastRead, [])
  const theme = useAppTheme()

  // Global keyboard shortcuts for the bookshelf
  useKeyboard(
    useMemo(
      () => ({
        // Open first book with Enter
        Enter: () => {
          if (books.length > 0) navigate(`/book/${books[0].id}`)
        },
        // Resume reading with 'r'
        r: () => {
          if (lastRead)
            navigate(
              `/book/${lastRead.bookId}/${lastRead.chapterId}`
            )
        },
      }),
      [books, lastRead, navigate]
    )
  )

  if (loading) return <BookshelfSkeleton />

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-bg)' }}>
        <ErrorState message={error} icon="error" onRetry={refetch} />
      </div>
    )
  }

  if (books.length === 0) return <EmptyState />

  const ps = getPageThemeStyle(theme)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: ps.pageBg,
        padding: 'clamp(1.5rem, 4vw, 3rem) clamp(1rem, 3vw, 1.5rem)',
        transition: 'background 400ms ease',
      }}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        {/* Header row — title + theme toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(1.8rem, 5vw, 2.6rem)',
                fontWeight: 600,
                color: ps.titleColor,
                letterSpacing: '-0.01em',
                margin: '0 0 var(--space-1) 0',
                transition: 'color var(--duration-slow) var(--ease-standard)',
              }}
            >
              Atheneum
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.95rem',
                color: ps.subtitleColor,
                margin: '0 0 var(--space-2) 0',
                letterSpacing: '0.04em',
                transition: 'color 400ms ease',
              }}
            >
              Your technical library
            </motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.15 }} style={{ margin: '0 0 2.5rem' }}>
              <Link to="/wishlist" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-ui)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
                <Sparkles size={13} strokeWidth={2.2} /> Wishlist — tell me what to build
              </Link>
            </motion.div>
          </div>

          {/* Theme toggle — premium segmented pill with prominent active state */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              paddingTop: '0.5rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: theme === 'light' ? 'color-mix(in srgb, var(--ink-primary) 4%, transparent)' : 'var(--chrome-surface)',
                border: 'var(--hairline)',
                borderRadius: 'var(--radius-full)',
                padding: 3,
                gap: 2,
                width: 150,
              }}
            >
              {([
                { key: 'light' as AppTheme, Icon: Sun, label: 'Light' },
                { key: 'dark' as AppTheme, Icon: Moon, label: 'Dark' },
                { key: 'sepia' as AppTheme, Icon: Coffee, label: 'Sepia' },
              ]).map(({ key, Icon, label }) => {
                const isActive = theme === key
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => {
                      localStorage.setItem('atheneum-theme', key)
                      document.documentElement.setAttribute('data-theme', key)
                      window.dispatchEvent(new Event('storage'))
                    }}
                    aria-label={`Switch to ${label} theme`}
                    aria-pressed={isActive}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 36,
                      border: 'none',
                      outline: 'none',
                      cursor: 'pointer',
                      padding: '0 var(--space-1)',
                      borderRadius: 'var(--radius-full)',
                      background: isActive ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'transparent',
                      color: isActive ? 'var(--accent)' : (theme === 'light' ? 'var(--ink-faint)' : 'var(--chrome-text)'),
                      transition: 'background var(--duration-base) var(--ease-standard), color var(--duration-base) var(--ease-standard), opacity var(--duration-base) var(--ease-standard)',
                      opacity: isActive ? 1 : 0.6,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.opacity = '0.9'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = isActive ? '1' : '0.6'
                    }}
                  >
                    <Icon size={16} strokeWidth={2} aria-hidden />
                  </button>
                )
              })}
            </div>
          </motion.div>
        </div>

        {/* Continue Reading */}
        {lastRead && (
          <ContinueReadingCard lastRead={lastRead} books={books} theme={theme} />
        )}

        {/* Book grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.75rem',
          }}
        >
          {books.filter(b => !(b as any).archived).map((book, i) => (
            <BookCard
              key={book.id}
              book={book}
              index={i}
              theme={theme}
              onArchive={async (id) => {
                try {
                  await fetch(`/api/books/${id}/archive`, { method: 'POST' })
                  await refetch()
                } catch { /* ignore */ }
              }}
              onDelete={async (id) => {
                try {
                  await fetch(`/api/books/${id}`, { method: 'DELETE' })
                  await refetch()
                } catch { /* ignore */ }
              }}
            />
          ))}
        </div>

        {/* ── Archived Books Section ──────────────────── */}
        {books.filter(b => (b as any).archived).length > 0 && (
          <ArchivedSection books={books.filter(b => (b as any).archived)} theme={theme} onChange={refetch} />
        )}
      </div>

      {/* Reveal the overflow menu button on card hover, on keyboard focus
          within the card, and when the button itself is tab-focused — so the
          destructive Delete action is reachable without a mouse. */}
      <style>{`
        .book-card:hover .book-card-menu-btn,
        .book-card:focus-within .book-card-menu-btn {
          opacity: 1 !important;
        }
        .book-card-menu-btn:focus-visible {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  )
}
