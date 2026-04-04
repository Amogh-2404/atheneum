import { useState, useRef, useEffect, useCallback } from 'react'
import { chapterToMarkdown } from '@/lib/markdown-export'
import { exportToEpub } from '@/lib/epub-export'

interface ExportMenuProps {
  bookId: string
  chapterId: string
  book: any
  chapter: any
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function ExportMenu({ bookId: _bookId, chapterId: _chapterId, book, chapter }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const [epubLoading, setEpubLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  const handleExportPdf = useCallback(() => {
    setOpen(false)
    setError(null)
    window.print()
  }, [])

  const handleExportMarkdown = useCallback(() => {
    if (!chapter) return
    setOpen(false)
    setError(null)
    try {
      const md = chapterToMarkdown(chapter)
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
      downloadBlob(blob, `${slugify(chapter.title)}.md`)
    } catch (err) {
      setError('Markdown export failed.')
      console.error(err)
    }
  }, [chapter])

  const handleExportEpub = useCallback(async () => {
    if (!book || !chapter) return
    setOpen(false)
    setError(null)
    setEpubLoading(true)
    try {
      // Export the current chapter as EPUB (single-chapter book)
      const blob = await exportToEpub(book, [chapter])
      downloadBlob(blob, `${slugify(book.title)}-${slugify(chapter.title)}.epub`)
    } catch (err: any) {
      setError(err.message || 'EPUB export failed.')
      console.error(err)
    } finally {
      setEpubLoading(false)
    }
  }, [book, chapter])

  const buttonStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontSize: '0.82rem',
    textDecoration: 'none',
    padding: '0.5rem 0.75rem',
    borderRadius: 4,
    color: 'var(--chrome-text)',
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'color 200ms ease, background 200ms ease',
    letterSpacing: '0.01em',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left' as const,
    width: '100%',
  }

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        style={buttonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--chrome-accent)'
          e.currentTarget.style.background = 'rgba(82, 254, 254, 0.06)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--chrome-text)'
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Export
        {epubLoading && (
          <span
            style={{
              width: 12,
              height: 12,
              border: '2px solid var(--chrome-border)',
              borderTopColor: 'var(--chrome-accent)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              marginLeft: 'auto',
              flexShrink: 0,
            }}
          />
        )}
      </button>

      {/* Error message */}
      {error && (
        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.7rem',
            color: '#f87171',
            padding: '0.25rem 0.75rem',
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            marginBottom: 4,
            background: 'var(--chrome-surface)',
            border: '1px solid var(--chrome-border)',
            borderRadius: 6,
            overflow: 'hidden',
            zIndex: 100,
            boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.3)',
          }}
        >
          <button
            onClick={handleExportPdf}
            style={buttonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#f1f5f9'
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--chrome-text)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Export PDF
          </button>
          <button
            onClick={handleExportMarkdown}
            style={buttonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#f1f5f9'
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--chrome-text)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16v16H4z" />
              <path d="M7 15V9l2.5 3L12 9v6" />
              <path d="M16 12l2 3h-4l2-3z" />
            </svg>
            Export Markdown
          </button>
          <button
            onClick={handleExportEpub}
            disabled={epubLoading}
            style={{
              ...buttonStyle,
              opacity: epubLoading ? 0.5 : 1,
              cursor: epubLoading ? 'wait' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!epubLoading) {
                e.currentTarget.style.color = '#f1f5f9'
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--chrome-text)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            {epubLoading ? 'Generating...' : 'Export EPUB'}
          </button>
        </div>
      )}
    </div>
  )
}
