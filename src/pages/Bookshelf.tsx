import { useMemo, useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useBooks } from '@/hooks/useBooks'
import { useKeyboard } from '@/hooks/useKeyboard'
import RoughBox from '@/components/shared/RoughBox'
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

/* ─── Theme-Specific Cover Palette ───────────────────────────────── */

interface CoverThemeStyle {
  /** Spine overlay gradient */
  spine: string
  /** Light sweep / glare */
  sweepHighlight: string
  sweepShadow: string
  /** Decorative border outer rgba */
  borderOuter: string
  /** Decorative border inner rgba */
  borderInner: string
  /** Corner ornament color + opacity */
  ornamentColor: string
  ornamentOpacity: number
  /** Chapter badge bg */
  badgeBg: string
  /** Chapter badge text */
  badgeText: string
  /** Icon filter — for glow effects */
  iconFilter: string
  /** Title text color */
  titleColor: string
  /** Title text shadow */
  titleShadow: string
  /** Author line color */
  authorColor: string
  /** Decorative rule gradient */
  ruleGradient: string
  /** Tag pill border */
  tagBorder: string
  /** Tag pill background */
  tagBg: string
  /** Tag pill text color */
  tagText: string
  /** Bottom edge shadow */
  bottomEdge: string
}

function getCoverThemeStyle(theme: AppTheme): CoverThemeStyle {
  switch (theme) {
    /* ── Dark: Neon Terminal — unmistakably cyberpunk ─────────── */
    case 'dark':
      return {
        spine: 'linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 30%, rgba(82,254,254,0.18) 50%, rgba(0,0,0,0.35) 100%)',
        sweepHighlight: 'radial-gradient(ellipse at 25% 15%, rgba(82,254,254,0.15) 0%, transparent 50%)',
        sweepShadow: 'radial-gradient(ellipse at 75% 85%, rgba(0,0,0,0.50) 0%, transparent 50%)',
        borderOuter: 'rgba(82, 254, 254, 0.30)',
        borderInner: 'rgba(82, 254, 254, 0.15)',
        ornamentColor: '#52FEFE',
        ornamentOpacity: 0.5,
        badgeBg: 'rgba(0,0,0,0.80)',
        badgeText: '#e8f4f4',
        iconFilter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.6)) drop-shadow(0 0 20px rgba(82,254,254,0.55))',
        titleColor: '#e8f4f4',
        titleShadow: '0 2px 16px rgba(0,0,0,0.7), 0 0 24px rgba(82,254,254,0.6), 0 0 48px rgba(82,254,254,0.2)',
        authorColor: 'rgba(82, 254, 254, 0.65)',
        ruleGradient: 'linear-gradient(90deg, transparent, rgba(82,254,254,0.5), transparent)',
        tagBorder: 'rgba(82, 254, 254, 0.25)',
        tagBg: 'rgba(0,0,0,0.5)',
        tagText: 'rgba(82, 254, 254, 0.7)',
        bottomEdge: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)',
      }

    /* ── Sepia: Leather Bound — antique bookshop ─────────────── */
    case 'sepia':
      return {
        spine: 'linear-gradient(90deg, rgba(30,18,8,0.75) 0%, rgba(42,26,14,0.35) 40%, rgba(212,168,80,0.10) 60%, rgba(42,26,14,0.30) 100%)',
        sweepHighlight: 'radial-gradient(ellipse at 25% 15%, rgba(244,236,216,0.20) 0%, transparent 50%)',
        sweepShadow: 'radial-gradient(ellipse at 75% 85%, rgba(30,18,8,0.35) 0%, transparent 50%)',
        borderOuter: 'rgba(212, 168, 80, 0.30)',
        borderInner: 'rgba(212, 168, 80, 0.18)',
        ornamentColor: '#d4a850',
        ornamentOpacity: 0.45,
        badgeBg: 'rgba(42,26,14,0.70)',
        badgeText: '#f4ecd8',
        iconFilter: 'drop-shadow(0 3px 8px rgba(42,26,14,0.5)) sepia(0.4) saturate(0.7)',
        titleColor: '#f4ecd8',
        titleShadow: '0 2px 12px rgba(42,26,14,0.6), 0 0 10px rgba(212,168,80,0.45), 0 1px 3px rgba(42,26,14,0.4)',
        authorColor: 'rgba(212, 168, 80, 0.75)',
        ruleGradient: 'linear-gradient(90deg, transparent, rgba(212,168,80,0.50), transparent)',
        tagBorder: 'rgba(212, 168, 80, 0.30)',
        tagBg: 'rgba(42,26,14,0.50)',
        tagText: 'rgba(212, 168, 80, 0.85)',
        bottomEdge: 'linear-gradient(to top, rgba(42,26,14,0.25), transparent)',
      }

    /* ── Light: Clean Editorial — airy, minimal, premium ───── */
    default:
      return {
        spine: 'linear-gradient(90deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.02) 50%, transparent 100%)',
        sweepHighlight: 'none',
        sweepShadow: 'none',
        borderOuter: 'rgba(0,0,0,0.10)',
        borderInner: 'rgba(0,0,0,0.06)',
        ornamentColor: 'rgba(0,0,0,0.25)',
        ornamentOpacity: 0.6,
        badgeBg: 'rgba(0,0,0,0.06)',
        badgeText: '#5a5a5a',
        iconFilter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.08))',
        titleColor: '#2c2c2c',
        titleShadow: 'none',
        authorColor: 'rgba(0,0,0,0.35)',
        ruleGradient: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.15), transparent)',
        tagBorder: 'rgba(0,0,0,0.10)',
        tagBg: 'rgba(0,0,0,0.04)',
        tagText: '#666',
        bottomEdge: 'linear-gradient(to top, rgba(0,0,0,0.04), transparent)',
      }
  }
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

function getPageThemeStyle(theme: AppTheme): PageThemeStyle {
  switch (theme) {
    case 'dark':
      return {
        pageBg: 'var(--chrome-bg)',
        titleColor: '#52FEFE',
        subtitleColor: 'var(--chrome-text)',
        textColor: '#f1f5f9',
        cardBg: 'var(--chrome-surface)',
        cardBorder: 'rgba(82, 254, 254, 0.15)',
        cardHoverBorder: 'rgba(82, 254, 254, 0.35)',
        cardHoverGlow: '0 0 24px rgba(82, 254, 254, 0.06)',
        accentColor: 'var(--chrome-accent)',
        bookInfoBg: 'var(--chrome-surface)',
        bookInfoSubtitle: 'var(--chrome-text)',
        bookInfoDesc: 'rgba(241, 245, 249, 0.75)',
        bookInfoMeta: 'rgba(241, 245, 249, 0.5)',
      }
    case 'sepia':
      return {
        pageBg: '#2a2015',
        titleColor: '#d4a373',
        subtitleColor: '#c4a882',
        textColor: '#f4ecd8',
        cardBg: 'rgba(58, 42, 26, 0.6)',
        cardBorder: 'rgba(212, 168, 80, 0.15)',
        cardHoverBorder: 'rgba(212, 168, 80, 0.35)',
        cardHoverGlow: '0 0 24px rgba(180, 140, 80, 0.1)',
        accentColor: '#d4a373',
        bookInfoBg: 'rgba(58, 42, 26, 0.6)',
        bookInfoSubtitle: '#c4a882',
        bookInfoDesc: 'rgba(244, 236, 216, 0.7)',
        bookInfoMeta: 'rgba(244, 236, 216, 0.45)',
      }
    default: // light
      return {
        pageBg: '#f8f6f1',
        titleColor: '#2c2c2c',
        subtitleColor: '#666',
        textColor: '#333',
        cardBg: '#ffffff',
        cardBorder: 'rgba(0,0,0,0.08)',
        cardHoverBorder: 'rgba(0,0,0,0.15)',
        cardHoverGlow: '0 4px 20px rgba(0,0,0,0.08)',
        accentColor: '#555',
        bookInfoBg: '#ffffff',
        bookInfoSubtitle: '#555',
        bookInfoDesc: 'rgba(0,0,0,0.55)',
        bookInfoMeta: 'rgba(0,0,0,0.38)',
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
            border: `1px solid ${ps.cardBorder}`,
            borderRadius: 12,
            padding: 'clamp(0.75rem, 2vw, 1.25rem) clamp(1rem, 2.5vw, 1.5rem)',
            backdropFilter: 'blur(12px)',
            transition:
              'border-color 200ms ease, box-shadow 200ms ease, transform 200ms ease',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget
            el.style.borderColor = ps.cardHoverBorder
            el.style.boxShadow = ps.cardHoverGlow
            el.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget
            el.style.borderColor = ps.cardBorder
            el.style.boxShadow = 'none'
            el.style.transform = 'translateY(0)'
          }}
        >
          {/* Label */}
          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.7rem',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: ps.accentColor,
              margin: '0 0 0.6rem 0',
            }}
          >
            Continue Reading
          </p>

          {/* Book + Chapter */}
          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '1.05rem',
              fontWeight: 600,
              color: ps.textColor,
              margin: '0 0 0.15rem 0',
            }}
          >
            {book.title}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.8rem',
              color: ps.subtitleColor,
              margin: '0 0 0.75rem 0',
            }}
          >
            Chapter: {lastRead.chapterId}
          </p>

          {/* Progress bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: theme === 'light' ? 'rgba(0,0,0,0.08)' : 'var(--chrome-border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${percent}%`,
                  background: ps.accentColor,
                  borderRadius: 2,
                  transition: 'width 300ms ease',
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
                fontFamily: 'var(--font-ui)',
                fontSize: '0.8rem',
                color: ps.accentColor,
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              Resume →
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

/* ─── Book Cover — Premium Design ────────────────────────────────── */

/**
 * Deterministic pseudo-random from a seed — used to vary pattern
 * angles and offsets per book so no two covers look identical.
 */
function seededRandom(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function BookCover({
  title,
  coverColor,
  coverIcon,
  chapterCount,
  tags,
  theme,
}: {
  title: string
  coverColor: string
  coverIcon?: string
  chapterCount: number
  tags: string[]
  theme: AppTheme
}) {
  const ts = getCoverThemeStyle(theme)

  const seed = hashSeed(title)
  const rand = seededRandom(seed)

  // Vary pattern offset per book
  const patternRotate = Math.round(-15 + rand() * 30)
  const dotOffsetX = Math.round(rand() * 40)
  const dotOffsetY = Math.round(rand() * 40)

  // ── Theme-specific background ──
  // Each theme gets a FUNDAMENTALLY different base

  let coverBackground: string

  if (theme === 'light') {
    // LIGHT base — cream/white with coverColor as subtle accent band
    coverBackground = '#f5f2ec'
  } else if (theme === 'dark') {
    // Dark gradient — keep working dark approach, blend coverColor into darkness
    const dark1 = `color-mix(in srgb, ${coverColor} 40%, #0a0e17)`
    const dark2 = `color-mix(in srgb, ${coverColor} 15%, #050810)`
    const angle = Math.round(130 + rand() * 40)
    coverBackground = `linear-gradient(${angle}deg, ${dark2} 0%, ${coverColor} 45%, ${dark1} 100%)`
  } else {
    // Sepia — rich warm brown tones, NOT coverColor-based
    coverBackground = `linear-gradient(165deg, #3a2a1a 0%, #2e1f12 40%, #2a1a0e 100%)`
  }

  // ── Dark theme patterns ──
  const circuitPattern = `url("data:image/svg+xml,%3Csvg width='40' height='40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 20 L10 20 L10 10 L30 10 L30 20 L40 20' fill='none' stroke='%2352FEFE' stroke-opacity='0.35' stroke-width='0.9'/%3E%3Cpath d='M20 0 L20 10' fill='none' stroke='%2352FEFE' stroke-opacity='0.30' stroke-width='0.7'/%3E%3Cpath d='M20 30 L20 40' fill='none' stroke='%2352FEFE' stroke-opacity='0.30' stroke-width='0.7'/%3E%3Ccircle cx='10' cy='10' r='2' fill='%2352FEFE' fill-opacity='0.40'/%3E%3Ccircle cx='30' cy='10' r='2' fill='%2352FEFE' fill-opacity='0.40'/%3E%3Ccircle cx='30' cy='20' r='1.4' fill='%2352FEFE' fill-opacity='0.30'/%3E%3Ccircle cx='20' cy='30' r='1.2' fill='%2352FEFE' fill-opacity='0.25'/%3E%3C/svg%3E")`
  const gridPattern = `url("data:image/svg+xml,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M24 0 L24 24 M0 24 L24 24' fill='none' stroke='%2352FEFE' stroke-opacity='0.10' stroke-width='0.5'/%3E%3C/svg%3E")`

  // ── Sepia theme patterns ──
  const damaskPattern = `url("data:image/svg+xml,%3Csvg width='32' height='32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M16 2 Q24 10 16 18 Q8 10 16 2 Z' fill='none' stroke='%23d4a850' stroke-opacity='0.20' stroke-width='0.9'/%3E%3Cpath d='M16 14 Q24 22 16 30 Q8 22 16 14 Z' fill='none' stroke='%23d4a850' stroke-opacity='0.17' stroke-width='0.8'/%3E%3Cpath d='M0 16 Q8 10 0 2' fill='none' stroke='%23d4a850' stroke-opacity='0.14' stroke-width='0.7'/%3E%3Cpath d='M32 16 Q24 10 32 2' fill='none' stroke='%23d4a850' stroke-opacity='0.14' stroke-width='0.7'/%3E%3Ccircle cx='16' cy='10' r='1.2' fill='%23d4a850' fill-opacity='0.18'/%3E%3C/svg%3E")`
  const leatherPattern = `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.14'/%3E%3C/svg%3E")`

  const visibleTags = tags.slice(0, 3)

  return (
    <div
      style={{
        width: '100%',
        aspectRatio: '3 / 4',
        borderRadius: '6px 6px 0 0',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'background 400ms ease',
        background: coverBackground,
      }}
    >

      {/* ═══════════════════════════════════════════════════════
          LIGHT THEME — "Clean Editorial"
          Light cream base, coverColor as horizontal accent band
          ═══════════════════════════════════════════════════════ */}
      {theme === 'light' && (
        <>
          {/* Wide horizontal color band at top — coverColor at 60% opacity */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '25%',
              background: coverColor,
              opacity: 0.55,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
          {/* Fade the band into cream */}
          <div
            style={{
              position: 'absolute',
              top: '15%',
              left: 0,
              right: 0,
              height: '15%',
              background: 'linear-gradient(to bottom, transparent, #f5f2ec)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
          {/* Thin single-line border frame */}
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              right: 10,
              bottom: 10,
              border: '1px solid rgba(0,0,0,0.10)',
              borderRadius: 2,
              pointerEvents: 'none',
              zIndex: 4,
            }}
          />
          {/* Spine: barely visible light gray strip */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 10,
              background: 'linear-gradient(90deg, rgba(0,0,0,0.04) 0%, transparent 100%)',
              zIndex: 5,
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          DARK THEME — "Neon Terminal"
          Circuit board + neon stripe + grid + CRT lines + glow
          ═══════════════════════════════════════════════════════ */}
      {theme === 'dark' && (
        <>
          {/* Dark tint overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(10,14,23,0.30) 0%, rgba(5,8,16,0.50) 100%)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
          {/* Spine with cyan edge glow */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 14,
              background: ts.spine,
              boxShadow: '1px 0 8px rgba(82,254,254,0.06)',
              zIndex: 5,
              pointerEvents: 'none',
            }}
          />
          {/* Primary: bold circuit board traces */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: circuitPattern,
              backgroundSize: '40px 40px',
              backgroundPosition: `${dotOffsetX}px ${dotOffsetY}px`,
              transform: `rotate(${patternRotate}deg) scale(1.2)`,
              opacity: 1,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
          {/* Secondary: graph paper grid */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: gridPattern,
              backgroundSize: '24px 24px',
              opacity: 1,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
          {/* NEON STRIPE — prominent glowing horizontal line at ~25% from top */}
          <div
            style={{
              position: 'absolute',
              top: '25%',
              left: 0,
              right: 0,
              height: 2,
              background: 'linear-gradient(90deg, transparent 5%, rgba(82,254,254,0.7) 20%, rgba(82,254,254,0.9) 50%, rgba(82,254,254,0.7) 80%, transparent 95%)',
              boxShadow: '0 0 16px rgba(82,254,254,0.5), 0 0 32px rgba(82,254,254,0.2), 0 0 4px rgba(82,254,254,0.8)',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />
          {/* CRT scan-line effect */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 3px,
                rgba(82, 254, 254, 0.035) 3px,
                rgba(82, 254, 254, 0.035) 4px
              )`,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
          {/* Border frame — double-line with cyan glow */}
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 22,
              right: 10,
              bottom: 10,
              border: `1px solid ${ts.borderOuter}`,
              borderRadius: 3,
              boxShadow: '0 0 10px rgba(82,254,254,0.10)',
              pointerEvents: 'none',
              zIndex: 4,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 26,
              right: 14,
              bottom: 14,
              border: `1px solid ${ts.borderInner}`,
              borderRadius: 2,
              pointerEvents: 'none',
              zIndex: 4,
            }}
          />
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          SEPIA THEME — "Leather Bound"
          Warm brown base, gold accents, strong vignette, page edges
          ═══════════════════════════════════════════════════════ */}
      {theme === 'sepia' && (
        <>
          {/* Gold/amber accent tint from coverColor — blended warm */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse at 50% 40%, color-mix(in srgb, ${coverColor} 20%, #d4a850) 0%, transparent 70%)`,
              opacity: 0.15,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
          {/* Spine */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 14,
              background: ts.spine,
              zIndex: 5,
              pointerEvents: 'none',
            }}
          />
          {/* Damask pattern */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: damaskPattern,
              backgroundSize: '32px 32px',
              backgroundPosition: `${dotOffsetX}px ${dotOffsetY}px`,
              transform: `rotate(${patternRotate}deg) scale(1.2)`,
              opacity: 1,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
          {/* Leather-grain noise texture */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: leatherPattern,
              backgroundSize: '200px 200px',
              opacity: 1,
              pointerEvents: 'none',
              zIndex: 2,
              mixBlendMode: 'overlay',
            }}
          />
          {/* Strong vignette — box-shadow inset */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              boxShadow: 'inset 0 0 60px 20px rgba(30, 18, 8, 0.60), inset 0 0 120px 40px rgba(30, 18, 8, 0.30)',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />
          {/* Page edge effect — right side, stacked lines */}
          <div
            style={{
              position: 'absolute',
              top: 4,
              right: 0,
              bottom: 4,
              width: 8,
              background: `repeating-linear-gradient(
                180deg,
                rgba(212,168,80,0.18) 0px,
                rgba(180,140,80,0.10) 1px,
                rgba(244,236,216,0.14) 2px,
                rgba(180,140,80,0.08) 3px
              )`,
              borderLeft: '1px solid rgba(212,168,80,0.25)',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          />
          {/* Border frame */}
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 22,
              right: 12,
              bottom: 10,
              border: `1px solid ${ts.borderOuter}`,
              borderRadius: 3,
              pointerEvents: 'none',
              zIndex: 4,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 14,
              left: 26,
              right: 16,
              bottom: 14,
              border: `1px solid ${ts.borderInner}`,
              borderRadius: 2,
              pointerEvents: 'none',
              zIndex: 4,
            }}
          />
        </>
      )}

      {/* ── Light sweep / glare (dark + sepia only) ──────── */}
      {theme !== 'light' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `${ts.sweepHighlight}, ${ts.sweepShadow}`,
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />
      )}

      {/* ── Corner ornaments — theme-specific ──────────────── */}
      {theme === 'dark' ? (
        <>
          {/* Dark: LARGE angular tech brackets */}
          <svg style={{ position: 'absolute', top: 4, left: 16, zIndex: 5, opacity: ts.ornamentOpacity }} width="28" height="28" viewBox="0 0 28 28">
            <path d="M0 24 L0 0 L24 0" fill="none" stroke={ts.ornamentColor} strokeWidth="1.8" />
            <path d="M0 16 L0 0 L16 0" fill="none" stroke={ts.ornamentColor} strokeWidth="0.8" strokeOpacity="0.5" />
          </svg>
          <svg style={{ position: 'absolute', top: 4, right: 4, zIndex: 5, opacity: ts.ornamentOpacity }} width="28" height="28" viewBox="0 0 28 28">
            <path d="M4 0 L28 0 L28 24" fill="none" stroke={ts.ornamentColor} strokeWidth="1.8" />
            <path d="M12 0 L28 0 L28 16" fill="none" stroke={ts.ornamentColor} strokeWidth="0.8" strokeOpacity="0.5" />
          </svg>
          <svg style={{ position: 'absolute', bottom: 4, left: 16, zIndex: 5, opacity: ts.ornamentOpacity }} width="28" height="28" viewBox="0 0 28 28">
            <path d="M0 4 L0 28 L24 28" fill="none" stroke={ts.ornamentColor} strokeWidth="1.8" />
            <path d="M0 12 L0 28 L16 28" fill="none" stroke={ts.ornamentColor} strokeWidth="0.8" strokeOpacity="0.5" />
          </svg>
          <svg style={{ position: 'absolute', bottom: 4, right: 4, zIndex: 5, opacity: ts.ornamentOpacity }} width="28" height="28" viewBox="0 0 28 28">
            <path d="M28 4 L28 28 L4 28" fill="none" stroke={ts.ornamentColor} strokeWidth="1.8" />
            <path d="M28 12 L28 28 L12 28" fill="none" stroke={ts.ornamentColor} strokeWidth="0.8" strokeOpacity="0.5" />
          </svg>
        </>
      ) : theme === 'sepia' ? (
        <>
          {/* Sepia: LARGE ornate corners with boosted opacity */}
          <svg style={{ position: 'absolute', top: 3, left: 15, zIndex: 5, opacity: ts.ornamentOpacity }} width="30" height="30" viewBox="0 0 30 30">
            <path d="M0 28 L0 6 Q0 0 6 0 L28 0" fill="none" stroke={ts.ornamentColor} strokeWidth="1.5" />
            <path d="M0 18 C5 18 7 16 7 11" fill="none" stroke={ts.ornamentColor} strokeWidth="1" strokeOpacity="0.7" />
            <path d="M12 0 C12 5 14 7 18 7" fill="none" stroke={ts.ornamentColor} strokeWidth="1" strokeOpacity="0.7" />
            <circle cx="3" cy="3" r="1.8" fill={ts.ornamentColor} fillOpacity="0.4" />
            <circle cx="3" cy="3" r="0.8" fill={ts.ornamentColor} fillOpacity="0.6" />
          </svg>
          <svg style={{ position: 'absolute', top: 3, right: 3, zIndex: 5, opacity: ts.ornamentOpacity }} width="30" height="30" viewBox="0 0 30 30">
            <path d="M2 0 L24 0 Q30 0 30 6 L30 28" fill="none" stroke={ts.ornamentColor} strokeWidth="1.5" />
            <path d="M18 0 C18 5 16 7 12 7" fill="none" stroke={ts.ornamentColor} strokeWidth="1" strokeOpacity="0.7" />
            <path d="M30 18 C25 18 23 16 23 11" fill="none" stroke={ts.ornamentColor} strokeWidth="1" strokeOpacity="0.7" />
            <circle cx="27" cy="3" r="1.8" fill={ts.ornamentColor} fillOpacity="0.4" />
            <circle cx="27" cy="3" r="0.8" fill={ts.ornamentColor} fillOpacity="0.6" />
          </svg>
          <svg style={{ position: 'absolute', bottom: 3, left: 15, zIndex: 5, opacity: ts.ornamentOpacity }} width="30" height="30" viewBox="0 0 30 30">
            <path d="M0 2 L0 24 Q0 30 6 30 L28 30" fill="none" stroke={ts.ornamentColor} strokeWidth="1.5" />
            <path d="M0 12 C5 12 7 14 7 19" fill="none" stroke={ts.ornamentColor} strokeWidth="1" strokeOpacity="0.7" />
            <path d="M12 30 C12 25 14 23 18 23" fill="none" stroke={ts.ornamentColor} strokeWidth="1" strokeOpacity="0.7" />
            <circle cx="3" cy="27" r="1.8" fill={ts.ornamentColor} fillOpacity="0.4" />
            <circle cx="3" cy="27" r="0.8" fill={ts.ornamentColor} fillOpacity="0.6" />
          </svg>
          <svg style={{ position: 'absolute', bottom: 3, right: 3, zIndex: 5, opacity: ts.ornamentOpacity }} width="30" height="30" viewBox="0 0 30 30">
            <path d="M30 2 L30 24 Q30 30 24 30 L2 30" fill="none" stroke={ts.ornamentColor} strokeWidth="1.5" />
            <path d="M30 12 C25 12 23 14 23 19" fill="none" stroke={ts.ornamentColor} strokeWidth="1" strokeOpacity="0.7" />
            <path d="M18 30 C18 25 16 23 12 23" fill="none" stroke={ts.ornamentColor} strokeWidth="1" strokeOpacity="0.7" />
            <circle cx="27" cy="27" r="1.8" fill={ts.ornamentColor} fillOpacity="0.4" />
            <circle cx="27" cy="27" r="0.8" fill={ts.ornamentColor} fillOpacity="0.6" />
          </svg>
        </>
      ) : (
        <>
          {/* Light: thin elegant corner lines in dark gray */}
          <svg style={{ position: 'absolute', top: 14, left: 14, zIndex: 5, opacity: ts.ornamentOpacity }} width="18" height="18" viewBox="0 0 18 18">
            <path d="M0 18 L0 3 Q0 0 3 0 L18 0" fill="none" stroke={ts.ornamentColor} strokeWidth="0.8" />
          </svg>
          <svg style={{ position: 'absolute', top: 14, right: 14, zIndex: 5, opacity: ts.ornamentOpacity }} width="18" height="18" viewBox="0 0 18 18">
            <path d="M0 0 L15 0 Q18 0 18 3 L18 18" fill="none" stroke={ts.ornamentColor} strokeWidth="0.8" />
          </svg>
          <svg style={{ position: 'absolute', bottom: 14, left: 14, zIndex: 5, opacity: ts.ornamentOpacity }} width="18" height="18" viewBox="0 0 18 18">
            <path d="M0 0 L0 15 Q0 18 3 18 L18 18" fill="none" stroke={ts.ornamentColor} strokeWidth="0.8" />
          </svg>
          <svg style={{ position: 'absolute', bottom: 14, right: 14, zIndex: 5, opacity: ts.ornamentOpacity }} width="18" height="18" viewBox="0 0 18 18">
            <path d="M18 0 L18 15 Q18 18 15 18 L0 18" fill="none" stroke={ts.ornamentColor} strokeWidth="0.8" />
          </svg>
        </>
      )}

      {/* ── Chapter count badge ──────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 18,
          right: 18,
          zIndex: 6,
          background: ts.badgeBg,
          backdropFilter: 'blur(6px)',
          borderRadius: 6,
          padding: '3px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ fontSize: '0.6rem', opacity: 0.8 }}>📖</span>
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.6rem',
            fontWeight: 600,
            color: ts.badgeText,
            letterSpacing: '0.03em',
          }}
        >
          {chapterCount}
        </span>
      </div>

      {/* ── Main content area ────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2.5rem 1.5rem 1rem 2rem',
          position: 'relative',
          zIndex: 6,
        }}
      >
        {/* Icon — large and prominent, with theme-aware glow */}
        {coverIcon && (
          <span
            style={{
              fontSize: '2.8rem',
              lineHeight: 1,
              marginBottom: '0.75rem',
              filter: ts.iconFilter,
              transition: 'filter 400ms ease',
            }}
          >
            {coverIcon}
          </span>
        )}

        {/* Thin decorative rule above title */}
        <div
          style={{
            width: 32,
            height: 1,
            background: ts.ruleGradient,
            marginBottom: '0.65rem',
          }}
        />

        {/* Title — dark text in light theme, light/glowing in others */}
        <h3
          style={{
            fontFamily: "'Caveat', cursive",
            fontSize: '1.55rem',
            fontWeight: 700,
            color: ts.titleColor,
            margin: 0,
            lineHeight: 1.25,
            textAlign: 'center',
            textShadow: ts.titleShadow,
            maxWidth: '90%',
            transition: 'color 400ms ease, text-shadow 400ms ease',
          }}
        >
          {title}
        </h3>

        {/* Thin rule below title */}
        <div
          style={{
            width: 24,
            height: 1,
            background: ts.ruleGradient,
            marginTop: '0.6rem',
          }}
        />

        {/* Author line */}
        <p
          style={{
            fontFamily: "'Rajdhani', var(--font-ui)",
            fontSize: '0.62rem',
            fontWeight: 500,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: ts.authorColor,
            margin: '0.6rem 0 0 0',
            textShadow: theme === 'light' ? 'none' : '0 1px 4px rgba(0,0,0,0.3)',
            transition: 'color 400ms ease',
          }}
        >
          Atheneum
        </p>
      </div>

      {/* ── Tag pills at bottom ──────────────────────────── */}
      {visibleTags.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 4,
            padding: '0 1.5rem 14px 2rem',
            position: 'relative',
            zIndex: 6,
          }}
        >
          {visibleTags.map((tag) => (
            <span
              key={tag}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.52rem',
                fontWeight: 500,
                letterSpacing: '0.04em',
                padding: '2px 7px',
                borderRadius: 999,
                border: `1px solid ${ts.tagBorder}`,
                background: ts.tagBg,
                backdropFilter: 'blur(4px)',
                color: ts.tagText,
                textTransform: 'lowercase',
                transition: 'border-color 400ms ease, background 400ms ease, color 400ms ease',
              }}
            >
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.52rem',
                fontWeight: 500,
                padding: '2px 6px',
                borderRadius: 999,
                color: ts.tagText,
                opacity: 0.6,
              }}
            >
              +{tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* ── Bottom edge shadow (page depth) ──────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: ts.bottomEdge,
          zIndex: 7,
          pointerEvents: 'none',
        }}
      />
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: index * 0.08,
        ease: 'easeOut',
      }}
      style={{ position: 'relative' }}
      onMouseLeave={() => { setMenuOpen(false); setConfirmDelete(false) }}
    >
      {/* Context menu button */}
      {(onArchive || onDelete) && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen); setConfirmDelete(false) }}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 200ms ease',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 700,
          }}
          className="book-card-menu-btn"
        >
          ···
        </button>
      )}

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            right: 8,
            zIndex: 20,
            background: 'var(--chrome-surface, #1a1a2e)',
            border: '1px solid var(--chrome-border, #333)',
            borderRadius: 8,
            padding: '4px 0',
            minWidth: 140,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
          onClick={(e) => e.preventDefault()}
        >
          {!confirmDelete ? (
            <>
              {onArchive && (
                <button
                  onClick={(e) => { e.stopPropagation(); onArchive(book.id); setMenuOpen(false) }}
                  style={{
                    display: 'block', width: '100%', padding: '8px 16px', border: 'none',
                    background: 'none', color: '#d4d4d4', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'var(--font-ui)', fontSize: '0.82rem',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                >
                  Archive
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(true) }}
                  style={{
                    display: 'block', width: '100%', padding: '8px 16px', border: 'none',
                    background: 'none', color: '#f87171', cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'var(--font-ui)', fontSize: '0.82rem',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,113,113,0.08)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                >
                  Delete
                </button>
              )}
            </>
          ) : (
            <div style={{ padding: '8px 12px' }}>
              <p style={{ fontSize: '0.78rem', color: '#fca5a5', margin: '0 0 8px 0', lineHeight: 1.4, fontFamily: 'var(--font-ui)' }}>
                Delete "{book.title}"? This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete!(book.id); setMenuOpen(false); setConfirmDelete(false) }}
                  style={{
                    flex: 1, padding: '6px', border: 'none', borderRadius: 4,
                    background: '#dc2626', color: '#fff', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 600,
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(false) }}
                  style={{
                    flex: 1, padding: '6px', border: '1px solid var(--chrome-border)',
                    borderRadius: 4, background: 'none', color: '#d4d4d4', cursor: 'pointer',
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
        <RoughBox
          stroke={theme === 'light' ? 'rgba(0,0,0,0.10)' : 'var(--chrome-border)'}
          strokeWidth={1.2}
          roughness={1.5}
          seed={hashSeed(book.id)}
          padding="0"
        >
          <div
            style={{
              background: ps.bookInfoBg,
              borderRadius: 6,
              overflow: 'hidden',
              transition:
                'transform 200ms ease, box-shadow 200ms ease',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget
              el.style.transform = 'scale(1.02)'
              el.style.boxShadow = ps.cardHoverGlow
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget
              el.style.transform = 'scale(1)'
              el.style.boxShadow = 'none'
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
                {book.chapterCount}{' '}
                {book.chapterCount === 1 ? 'chapter' : 'chapters'}
              </p>
            </div>
          </div>
        </RoughBox>
      </Link>
    </motion.div>
  )
}

/* ─── Spinner ─────────────────────────────────────────────────────── */

/* ─── Archived Books Section ──────────────────────────────────────── */

function ArchivedSection({ books, theme }: { books: BookSummary[]; theme: AppTheme }) {
  const [expanded, setExpanded] = useState(false)
  const ps = getPageThemeStyle(theme)

  return (
    <div style={{ marginTop: '3rem' }}>
      <button
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
                onClick={async () => {
                  try {
                    await fetch(`/api/books/${book.id}/unarchive`, { method: 'POST' })
                    window.location.reload()
                  } catch { /* ignore */ }
                }}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  zIndex: 10,
                  padding: '6px 14px',
                  borderRadius: 6,
                  background: 'rgba(212,175,55,0.15)',
                  border: '1px solid rgba(212,175,55,0.3)',
                  color: '#d4af37',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(212,175,55,0.25)'
                  e.currentTarget.style.borderColor = '#d4af37'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(212,175,55,0.15)'
                  e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)'
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

/* ─── Spinner ─────────────────────────────────────────────────────── */

function Spinner() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--chrome-bg)',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: '2px solid var(--chrome-border)',
          borderTopColor: 'var(--chrome-accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
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
        background: 'var(--chrome-bg)',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-handwritten)',
          fontSize: '1.4rem',
          color: 'var(--chrome-text)',
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
  const { books, loading, error } = useBooks()
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

  if (loading) return <Spinner />

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--chrome-bg)',
        }}
      >
        <p style={{ color: '#f87171' }}>{error}</p>
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
                fontFamily: "'Rajdhani', var(--font-ui)",
                fontSize: 'clamp(1.6rem, 5vw, 2.4rem)',
                fontWeight: 700,
                color: ps.titleColor,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                margin: '0 0 0.25rem 0',
                transition: 'color 400ms ease',
              }}
            >
              ATHENEUM
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.95rem',
                color: ps.subtitleColor,
                margin: '0 0 2.5rem 0',
                letterSpacing: '0.04em',
                transition: 'color 400ms ease',
              }}
            >
              Your technical library
            </motion.p>
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
                background: theme === 'light' ? 'rgba(0,0,0,0.04)' : 'var(--chrome-surface)',
                border: `1px solid ${theme === 'light' ? 'rgba(0,0,0,0.08)' : 'var(--chrome-border)'}`,
                borderRadius: 22,
                padding: 3,
                gap: 2,
                width: 150,
              }}
            >
              {([
                { key: 'light' as AppTheme, icon: '\u2600', label: 'Light' },
                { key: 'dark' as AppTheme, icon: '\uD83C\uDF19', label: 'Dark' },
                { key: 'sepia' as AppTheme, icon: '\uD83E\uDEB6', label: 'Sepia' },
              ]).map(({ key, icon }) => {
                const isActive = theme === key
                const activeBg = key === 'dark'
                  ? 'rgba(82,254,254,0.20)'
                  : key === 'sepia'
                    ? 'rgba(180,140,80,0.20)'
                    : 'rgba(255,255,255,0.90)'
                const activeTextColor = key === 'dark'
                  ? '#52FEFE'
                  : key === 'sepia'
                    ? '#d4a850'
                    : '#333'
                const activeGlow = key === 'dark'
                  ? '0 0 12px rgba(82,254,254,0.25), inset 0 0 8px rgba(82,254,254,0.08)'
                  : key === 'sepia'
                    ? '0 0 12px rgba(180,140,80,0.20), inset 0 0 8px rgba(180,140,80,0.06)'
                    : '0 1px 6px rgba(0,0,0,0.10)'
                return (
                  <button
                    key={key}
                    onClick={() => {
                      localStorage.setItem('atheneum-theme', key)
                      document.documentElement.setAttribute('data-theme', key)
                      window.dispatchEvent(new Event('storage'))
                    }}
                    aria-label={`Switch to ${key} theme`}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0,
                      height: 32,
                      border: 'none',
                      outline: 'none',
                      cursor: 'pointer',
                      padding: '0 4px',
                      borderRadius: 18,
                      background: isActive ? activeBg : 'transparent',
                      boxShadow: isActive ? activeGlow : 'none',
                      color: isActive ? activeTextColor : (theme === 'light' ? 'rgba(0,0,0,0.4)' : 'var(--chrome-text)'),
                      fontFamily: 'var(--font-ui)',
                      fontSize: '1rem',
                      fontWeight: isActive ? 600 : 400,
                      transition: 'all 250ms ease',
                      transform: isActive ? 'scale(1.08)' : 'scale(1)',
                      opacity: isActive ? 1 : 0.5,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.opacity = '0.85'
                        e.currentTarget.style.transform = 'scale(1.08)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = isActive ? '1' : '0.5'
                      e.currentTarget.style.transform = isActive ? 'scale(1.08)' : 'scale(1)'
                    }}
                  >
                    <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{icon}</span>
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
                  window.location.reload()
                } catch { /* ignore */ }
              }}
              onDelete={async (id) => {
                try {
                  await fetch(`/api/books/${id}`, { method: 'DELETE' })
                  window.location.reload()
                } catch { /* ignore */ }
              }}
            />
          ))}
        </div>

        {/* ── Archived Books Section ──────────────────── */}
        {books.filter(b => (b as any).archived).length > 0 && (
          <ArchivedSection books={books.filter(b => (b as any).archived)} theme={theme} />
        )}
      </div>

      {/* Keyframe for spinner + book card menu hover */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        /* Show menu button on card hover */
        [style*="position: relative"]:hover .book-card-menu-btn {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  )
}
