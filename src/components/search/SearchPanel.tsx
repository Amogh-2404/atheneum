import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { tween, spring } from '@/lib/motion'
import { useSearch } from '@/hooks/useSearch'

interface SearchPanelProps {
  isOpen: boolean
  onClose: () => void
}

interface PaletteAction {
  id: string
  label: string
  hint: string
  perform: () => void
}

const BLOCK_ICONS: Record<string, string> = {
  heading: 'H', text: 'T', code: '</>', callout: '!', quote: '"', list: '•', summary: 'S', math: 'fx',
}

export default function SearchPanel({ isOpen, onClose }: SearchPanelProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { results, search, indexed, indexing } = useSearch()
  const [input, setInput] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Context-aware commands — search becomes command+content, not just content.
  const actions = useMemo<PaletteAction[]>(() => {
    const m = location.pathname.match(/^\/book\/([^/]+)/)
    const bookId = m?.[1]
    const list: PaletteAction[] = []
    if (bookId) {
      list.push(
        { id: 'a-read', label: 'Open Reader', hint: 'Read', perform: () => navigate(`/book/${bookId}`) },
        { id: 'a-map', label: 'Open Knowledge Map', hint: 'Map', perform: () => navigate(`/book/${bookId}/graph`) },
        { id: 'a-study', label: 'Open Study', hint: 'Study', perform: () => navigate(`/book/${bookId}/study`) },
        { id: 'a-notebook', label: 'Open Notebook', hint: 'Notebook', perform: () => navigate(`/book/${bookId}/notebook`) },
        { id: 'a-brief', label: 'Open Morning Brief', hint: 'Forge', perform: () => navigate(`/book/${bookId}/brief`) },
      )
    }
    list.push({ id: 'a-home', label: 'Go to Bookshelf', hint: 'Home', perform: () => navigate('/') })
    return list
  }, [location.pathname, navigate])

  const filteredActions = useMemo(() => {
    const q = input.trim().toLowerCase()
    if (!q) return actions
    return actions.filter((a) => a.label.toLowerCase().includes(q))
  }, [actions, input])

  const total = filteredActions.length + results.length

  useEffect(() => {
    if (isOpen) {
      setInput('')
      setSelectedIndex(0)
      search('')
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isOpen, search])

  useEffect(() => { setSelectedIndex(0) }, [results, input])

  useEffect(() => {
    const row = listRef.current?.querySelectorAll('[data-row]')[selectedIndex] as HTMLElement | undefined
    row?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const runAt = useCallback((idx: number) => {
    if (idx < filteredActions.length) {
      filteredActions[idx]?.perform()
      onClose()
    } else {
      const r = results[idx - filteredActions.length]
      if (r) { navigate(`/book/${r.bookId}/${r.chapterId}#${r.blockId}`); onClose() }
    }
  }, [filteredActions, results, navigate, onClose])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, total - 1)); break
      case 'ArrowUp': e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); break
      case 'Enter': e.preventDefault(); runAt(selectedIndex); break
      case 'Escape': e.preventDefault(); onClose(); break
    }
  }, [total, selectedIndex, runAt, onClose])

  function renderSnippet(snippet: string, query: string) {
    if (!query.trim()) return snippet
    const idx = snippet.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return snippet
    return (
      <>
        {snippet.slice(0, idx)}
        <span style={{ color: 'var(--chrome-accent)', fontWeight: 600 }}>{snippet.slice(idx, idx + query.length)}</span>
        {snippet.slice(idx + query.length)}
      </>
    )
  }

  const groupHeader = (label: string) => (
    <div style={{ padding: '10px 16px 4px', fontFamily: 'var(--font-ui)', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--chrome-text)', opacity: 0.45 }}>
      {label}
    </div>
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tween.fast}
          onClick={onClose}
          style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 'max(2rem, 9vh)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.985 }} transition={spring.default}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 600, maxWidth: 'calc(100vw - 1.5rem)', maxHeight: 'calc(100vh - 6rem)',
              background: 'var(--chrome-glass)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)',
              border: '1px solid var(--chrome-border)', borderRadius: 'var(--radius-3)', overflow: 'hidden',
              display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-4)',
            }}
          >
            <div style={{ position: 'relative' }}>
              <input
                ref={inputRef} value={input}
                onChange={(e) => { setInput(e.target.value); search(e.target.value) }}
                onKeyDown={onKeyDown}
                placeholder={indexing ? 'Building search index…' : 'Search the library, or jump to…'}
                style={{ width: '100%', padding: '16px 64px 16px 20px', fontFamily: 'var(--font-ui)', fontSize: '1.1rem', fontWeight: 500, background: 'transparent', border: 'none', borderBottom: '1px solid var(--chrome-border)', color: 'var(--chrome-hover-text, #f1f5f9)', outline: 'none', letterSpacing: '0.01em', boxSizing: 'border-box' }}
              />
              <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--chrome-text)', opacity: 0.4, border: '1px solid var(--chrome-border)', borderRadius: 'var(--radius-1)', padding: '2px 6px', letterSpacing: '0.03em' }}>ESC</span>
            </div>

            <div ref={listRef} style={{ flex: 1, overflowY: 'auto', paddingBottom: 4 }}>
              {indexing && !indexed && (
                <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '0.85rem', color: 'var(--chrome-text)' }}>
                  <div style={{ width: 20, height: 20, border: '2px solid var(--chrome-border)', borderTopColor: 'var(--chrome-accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                  Indexing book content…
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {filteredActions.length > 0 && groupHeader('Jump to')}
              {filteredActions.map((a, i) => {
                const sel = i === selectedIndex
                return (
                  <button key={a.id} type="button" data-row tabIndex={-1}
                    onClick={() => runAt(i)} onMouseEnter={() => setSelectedIndex(i)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 16px', background: sel ? 'color-mix(in srgb, var(--chrome-accent) 9%, transparent)' : 'transparent', border: 'none', borderLeft: `2px solid ${sel ? 'var(--chrome-accent)' : 'transparent'}`, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
                    <span aria-hidden style={{ fontSize: '0.85rem', color: 'var(--chrome-accent)', width: 16, textAlign: 'center', flexShrink: 0 }}>&rarr;</span>
                    <span style={{ fontSize: '0.86rem', fontWeight: 500, color: sel ? 'var(--chrome-hover-text, #f1f5f9)' : 'var(--chrome-text)' }}>{a.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.66rem', color: 'var(--chrome-text)', opacity: 0.4, letterSpacing: '0.04em' }}>{a.hint}</span>
                  </button>
                )
              })}

              {indexed && input.trim() && results.length === 0 && filteredActions.length === 0 && (
                <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: '0.85rem', color: 'var(--chrome-text)', opacity: 0.6 }}>No results for &ldquo;{input}&rdquo;</div>
              )}

              {results.length > 0 && groupHeader('In the books')}
              {results.map((result, j) => {
                const idx = filteredActions.length + j
                const sel = idx === selectedIndex
                return (
                  <button key={result.id} type="button" data-row tabIndex={-1}
                    onClick={() => runAt(idx)} onMouseEnter={() => setSelectedIndex(idx)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', background: sel ? 'color-mix(in srgb, var(--chrome-accent) 9%, transparent)' : 'transparent', border: 'none', borderLeft: `2px solid ${sel ? 'var(--chrome-accent)' : 'transparent'}`, cursor: 'pointer', fontFamily: 'var(--font-ui)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--chrome-accent)', background: 'color-mix(in srgb, var(--chrome-accent) 12%, transparent)', padding: '1px 5px', borderRadius: 'var(--radius-1)', letterSpacing: '0.04em', flexShrink: 0 }}>{BLOCK_ICONS[result.blockType] || result.blockType}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--chrome-text)', opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.bookTitle}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--chrome-text)', opacity: 0.3 }}>/</span>
                      <span style={{ fontSize: '0.78rem', color: sel ? 'var(--chrome-hover-text, #f1f5f9)' : 'var(--chrome-text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Ch.{result.chapterNumber} {result.chapterTitle}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: sel ? 'var(--chrome-hover-text, #cbd5e1)' : 'var(--chrome-text)', opacity: sel ? 0.9 : 0.7, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{renderSnippet(result.snippet, input)}</div>
                  </button>
                )
              })}
            </div>

            <div style={{ borderTop: '1px solid var(--chrome-border)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--chrome-text)', opacity: 0.5 }}>
              {!('ontouchstart' in window) && (
                <>
                  <span><kbd style={{ fontSize: '0.65rem' }}>↑↓</kbd> navigate</span>
                  <span><kbd style={{ fontSize: '0.65rem' }}>↵</kbd> open</span>
                </>
              )}
              <span style={{ marginLeft: 'auto' }}>{total} result{total !== 1 ? 's' : ''}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
