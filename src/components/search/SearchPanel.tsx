import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearch } from '@/hooks/useSearch'
import type { SearchResult } from '@/hooks/useSearch'

interface SearchPanelProps {
  isOpen: boolean
  onClose: () => void
}

/* ─── Block type icons (tiny text labels) ─────────────────────── */
const BLOCK_ICONS: Record<string, string> = {
  heading: 'H',
  text: 'T',
  code: '</>',
  callout: '!',
  quote: '"',
  list: '•',
  summary: 'S',
  math: 'fx',
}

export default function SearchPanel({ isOpen, onClose }: SearchPanelProps) {
  const navigate = useNavigate()
  const { results, search, indexed, indexing } = useSearch()
  const [input, setInput] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setInput('')
      setSelectedIndex(0)
      search('')
      // Small delay so the DOM mounts before focus
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isOpen, search])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[selectedIndex] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const handleSelect = useCallback((result: SearchResult) => {
    navigate(`/book/${result.bookId}/${result.chapterId}#${result.blockId}`)
    onClose()
  }, [navigate, onClose])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [results, selectedIndex, handleSelect, onClose])

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInput(val)
    search(val)
  }, [search])

  // Highlight the query match within the snippet
  function renderSnippet(snippet: string, query: string) {
    if (!query.trim()) return snippet
    const lower = snippet.toLowerCase()
    const qLower = query.toLowerCase()
    const idx = lower.indexOf(qLower)
    if (idx === -1) return snippet
    return (
      <>
        {snippet.slice(0, idx)}
        <span style={{ color: 'var(--chrome-accent)', fontWeight: 600 }}>
          {snippet.slice(idx, idx + query.length)}
        </span>
        {snippet.slice(idx + query.length)}
      </>
    )
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 'max(2rem, 8vh)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 600,
              maxWidth: 'calc(100vw - 1.5rem)',
              maxHeight: 'calc(100vh - 6rem)',
              background: 'var(--chrome-surface)',
              border: '1px solid var(--chrome-border)',
              borderRadius: 12,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5), 0 0 1px rgba(82, 254, 254, 0.15)',
            }}
          >
            {/* ─── Input ─── */}
            <div style={{ position: 'relative' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={onInputChange}
                onKeyDown={onKeyDown}
                placeholder={indexing ? 'Building search index...' : 'Search across all books...'}
                disabled={!indexed && !indexing}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  paddingRight: 60,
                  fontFamily: 'var(--font-ui)',
                  fontSize: '1.1rem',
                  fontWeight: 500,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--chrome-border)',
                  color: '#f1f5f9',
                  outline: 'none',
                  letterSpacing: '0.01em',
                  boxSizing: 'border-box',
                }}
              />
              {/* Kbd hint */}
              <span
                style={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.7rem',
                  color: 'var(--chrome-text)',
                  opacity: 0.4,
                  border: '1px solid var(--chrome-border)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  letterSpacing: '0.03em',
                }}
              >
                ESC
              </span>
            </div>

            {/* ─── Results ─── */}
            <div
              ref={listRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: results.length > 0 ? '4px 0' : 0,
              }}
            >
              {indexing && !indexed && (
                <div
                  style={{
                    padding: '2rem',
                    textAlign: 'center',
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.85rem',
                    color: 'var(--chrome-text)',
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      border: '2px solid var(--chrome-border)',
                      borderTopColor: 'var(--chrome-accent)',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      margin: '0 auto 12px',
                    }}
                  />
                  Indexing book content...
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {indexed && input.trim() && results.length === 0 && (
                <div
                  style={{
                    padding: '2rem',
                    textAlign: 'center',
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.85rem',
                    color: 'var(--chrome-text)',
                    opacity: 0.6,
                  }}
                >
                  No results for "{input}"
                </div>
              )}

              {indexed && !input.trim() && (
                <div
                  style={{
                    padding: '2rem',
                    textAlign: 'center',
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.85rem',
                    color: 'var(--chrome-text)',
                    opacity: 0.4,
                  }}
                >
                  Start typing to search...
                </div>
              )}

              {results.map((result, i) => {
                const isSelected = i === selectedIndex
                return (
                  <button
                    key={result.id}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '10px 16px',
                      background: isSelected ? 'rgba(82, 254, 254, 0.06)' : 'transparent',
                      border: 'none',
                      borderLeft: isSelected ? '2px solid var(--chrome-accent)' : '2px solid transparent',
                      cursor: 'pointer',
                      transition: 'background 100ms ease',
                      fontFamily: 'var(--font-ui)',
                    }}
                  >
                    {/* Top line: book + chapter */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      {/* Block type badge */}
                      <span
                        style={{
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          color: 'var(--chrome-accent)',
                          background: 'rgba(82, 254, 254, 0.08)',
                          padding: '1px 5px',
                          borderRadius: 3,
                          letterSpacing: '0.04em',
                          flexShrink: 0,
                        }}
                      >
                        {BLOCK_ICONS[result.blockType] || result.blockType}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--chrome-text)',
                          opacity: 0.6,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {result.bookTitle}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--chrome-text)', opacity: 0.3 }}>
                        /
                      </span>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          color: isSelected ? '#f1f5f9' : 'var(--chrome-text)',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Ch.{result.chapterNumber} {result.chapterTitle}
                      </span>
                    </div>
                    {/* Snippet */}
                    <div
                      style={{
                        fontSize: '0.82rem',
                        color: isSelected ? 'var(--ink-primary, #cbd5e1)' : 'var(--chrome-text, #94a3b8)',
                        lineHeight: 1.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {renderSnippet(result.snippet, input)}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* ─── Footer ─── */}
            {results.length > 0 && (
              <div
                style={{
                  borderTop: '1px solid var(--chrome-border)',
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.7rem',
                  color: 'var(--chrome-text)',
                  opacity: 0.5,
                }}
              >
                {/* Hide keyboard hints on touch devices */}
                {!('ontouchstart' in window) && (
                  <>
                    <span>
                      <kbd style={{ opacity: 0.7, fontSize: '0.65rem' }}>↑↓</kbd> navigate
                    </span>
                    <span>
                      <kbd style={{ opacity: 0.7, fontSize: '0.65rem' }}>↵</kbd> open
                    </span>
                  </>
                )}
                <span style={{ marginLeft: 'auto' }}>
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
