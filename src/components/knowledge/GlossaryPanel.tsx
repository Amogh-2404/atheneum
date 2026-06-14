import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
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
        el.style.borderRadius = '4px'
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
          background: 'rgba(0, 0, 0, 0.4)',
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
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
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
              fontWeight: 700,
              color: 'var(--chrome-accent)',
              margin: 0,
            }}
          >
            Glossary
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: isMobile ? 'rgba(82, 254, 254, 0.08)' : 'none',
              border: '1px solid var(--chrome-border)',
              borderRadius: isMobile ? 8 : 4,
              color: 'var(--chrome-text)',
              cursor: 'pointer',
              width: isMobile ? 44 : 28,
              height: isMobile ? 44 : 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? '20px' : '14px',
              fontFamily: 'var(--font-ui)',
              fontWeight: isMobile ? 700 : 400,
              transition: 'color 200ms ease, border-color 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--chrome-hover-text, #f1f5f9)'
              e.currentTarget.style.borderColor = 'var(--chrome-accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--chrome-text)'
              e.currentTarget.style.borderColor = 'var(--chrome-border)'
            }}
          >
            &times;
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '0.75rem 1.5rem' }}>
          <input
            type="text"
            placeholder="Filter concepts..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: isMobile ? '0.75rem 1rem' : '0.5rem 0.75rem',
              fontFamily: 'var(--font-ui)',
              fontSize: isMobile ? '1rem' : '0.85rem',
              background: 'var(--chrome-surface)',
              border: '1px solid var(--chrome-border)',
              borderRadius: 6,
              color: '#e2e8f0',
              outline: 'none',
              transition: 'border-color 200ms ease',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--chrome-accent)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--chrome-border)' }}
          />
        </div>

        {/* Count */}
        <div
          style={{
            padding: '0 1.5rem 0.5rem',
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
            padding: '0 1.5rem 1.5rem',
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
            <div key={letter} style={{ marginBottom: '1rem' }}>
              {/* Letter header */}
              <div
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: 'var(--chrome-accent)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  padding: '0.5rem 0 0.25rem',
                  borderBottom: '1px solid var(--chrome-border)',
                  marginBottom: '0.5rem',
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
                    padding: '0.5rem 0.5rem',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'background 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(82, 254, 254, 0.06)'
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
                      fontWeight: 700,
                      color: '#e2e8f0',
                      marginBottom: 2,
                    }}
                  >
                    {concept.name}
                    {getRefCount(concept.name) > 0 && (
                      <span
                        style={{
                          fontFamily: 'var(--font-ui)',
                          fontSize: '0.65rem',
                          color: 'var(--chrome-text)',
                          marginLeft: 8,
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
