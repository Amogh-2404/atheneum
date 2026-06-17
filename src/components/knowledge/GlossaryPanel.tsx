import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, X } from 'lucide-react'
import type { ConceptIndex, Concept } from '@/lib/concept-extractor'

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint
  )
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

interface Props {
  conceptIndex: ConceptIndex
  bookId: string
  onClose: () => void
}

export default function GlossaryPanel({ conceptIndex, bookId: _bookId, onClose }: Props) {
  const [filter, setFilter] = useState('')
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  // Build sorted alphabetical list
  const entries = useMemo(() => {
    const all: Concept[] = []
    conceptIndex.concepts.forEach((c) => all.push(c))
    all.sort((a, b) => a.name.localeCompare(b.name))
    return all
  }, [conceptIndex])

  // Filtered entries
  const filtered = useMemo(() => {
    if (!filter.trim()) return entries
    const q = filter.toLowerCase().trim()
    return entries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.definition.toLowerCase().includes(q)
    )
  }, [entries, filter])

  // Group by first letter
  const grouped = useMemo(() => {
    const groups: Record<string, Concept[]> = {}
    for (const c of filtered) {
      const letter = c.name[0]?.toUpperCase() || '#'
      if (!groups[letter]) groups[letter] = []
      groups[letter].push(c)
    }
    return groups
  }, [filtered])

  const goToDefinition = (concept: Concept) => {
    navigate(`/book/${concept.bookId}/${concept.chapterId}`)
    setTimeout(() => {
      const el = document.getElementById(concept.blockId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.style.outline = '2px solid var(--chrome-accent)'
        el.style.outlineOffset = '4px'
        el.style.borderRadius = 'var(--radius-1)'
        el.style.transition = 'outline-color 1.5s ease'
        setTimeout(() => { el.style.outlineColor = 'transparent' }, 1500)
      }
    }, 300)
    onClose()
  }

  // Count references for a concept
  const getRefCount = (name: string): number => {
    const refs = conceptIndex.references.get(name.toLowerCase())
    return refs ? refs.length : 0
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'var(--chrome-glass)',
          zIndex: 90,
        }}
      />

      {/* Panel */}
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: isMobile ? '100vw' : 380,
          maxWidth: isMobile ? '100vw' : '90vw',
          zIndex: 100,
          background: 'var(--chrome-bg)',
          borderLeft: '1px solid var(--chrome-border)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-4)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 'var(--space-5) var(--space-5)',
            borderBottom: '1px solid var(--chrome-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: isMobile ? '1.25rem' : '1.5rem',
              fontWeight: 600,
              color: 'var(--chrome-accent)',
              margin: 0,
            }}
          >
            Glossary
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close glossary"
            style={{
              background: isMobile ? 'var(--chrome-surface)' : 'none',
              border: '1px solid var(--chrome-border)',
              borderRadius: 'var(--radius-2)',
              color: 'var(--chrome-text)',
              cursor: 'pointer',
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'color 200ms ease, border-color 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--chrome-hover-text)'
              e.currentTarget.style.borderColor = 'var(--chrome-accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--chrome-text)'
              e.currentTarget.style.borderColor = 'var(--chrome-border)'
            }}
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: 'var(--space-3) var(--space-5)' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search
              size={16}
              strokeWidth={2}
              aria-hidden
              style={{ position: 'absolute', left: 'var(--space-3)', color: 'var(--chrome-text)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              placeholder="Filter concepts..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                minHeight: 44,
                padding: '0 var(--space-3) 0 calc(var(--space-3) + var(--space-5))',
                fontFamily: 'var(--font-ui)',
                fontSize: isMobile ? '1rem' : '0.85rem',
                background: 'var(--chrome-surface)',
                border: '1px solid var(--chrome-border)',
                borderRadius: 'var(--radius-2)',
                color: 'var(--chrome-hover-text)',
                outline: 'none',
                transition: 'border-color 200ms ease',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--chrome-accent)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--chrome-border)' }}
            />
          </div>
        </div>

        {/* Count */}
        <div
          style={{
            padding: '0 var(--space-5) var(--space-2)',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.7rem',
            color: 'var(--chrome-text)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          {filtered.length} concept{filtered.length !== 1 ? 's' : ''}
          {filter.trim() && ` matching "${filter.trim()}"`}
        </div>

        {/* Concept list */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 var(--space-5) var(--space-5)',
          }}
        >
          {Object.keys(grouped).length === 0 && (
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '1rem',
                color: 'var(--chrome-text)',
                padding: '2rem 0',
                textAlign: 'center',
              }}
            >
              No concepts found.
            </div>
          )}

          {Object.entries(grouped).map(([letter, concepts]) => (
            <div key={letter} style={{ marginBottom: 'var(--space-4)' }}>
              {/* Letter header */}
              <div
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'var(--chrome-accent)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: 'var(--space-2) 0 var(--space-1)',
                  borderBottom: '1px solid var(--chrome-border)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                {letter}
              </div>

              {concepts.map((concept) => (
                <button
                  type="button"
                  key={concept.name}
                  onClick={() => goToDefinition(concept)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-2)',
                    cursor: 'pointer',
                    transition: 'background 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--chrome-surface)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none'
                  }}
                >
                  {/* Name */}
                  <div
                    style={{
                      fontFamily: 'var(--font-heading)',
                      fontSize: isMobile ? '0.95rem' : '1.1rem',
                      fontWeight: 600,
                      color: 'var(--chrome-hover-text)',
                      marginBottom: 'var(--space-1)',
                    }}
                  >
                    {concept.name}
                    {getRefCount(concept.name) > 0 && (
                      <span
                        style={{
                          fontFamily: 'var(--font-ui)',
                          fontSize: '0.65rem',
                          color: 'var(--chrome-text)',
                          marginLeft: 'var(--space-2)',
                          fontWeight: 400,
                        }}
                      >
                        {getRefCount(concept.name)} ref{getRefCount(concept.name) !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Definition snippet */}
                  <div
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: isMobile ? '0.8rem' : '0.9rem',
                      color: 'var(--chrome-text)',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {concept.definition}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </motion.aside>
    </>
  )
}
