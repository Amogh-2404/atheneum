import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { chapterToMarkdown } from '@/lib/markdown-export'
import { exportToEpub } from '@/lib/epub-export'
import { fetchJSON } from '@/lib/api'

interface ChapterSummary {
  id: string
  number: number
  title: string
}

interface ExportMenuProps {
  bookId: string
  chapterId: string
  book: any
  chapter: any
}

type ExportScope = 'current' | 'all' | 'custom'
type ExportFormat = 'pdf' | 'markdown' | 'epub'

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
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Build a cover page + table of contents in markdown format
function buildCoverMarkdown(book: any, chapters: ChapterSummary[], scope: ExportScope): string {
  const lines: string[] = []
  lines.push(`# ${book.title}`)
  if (book.subtitle) lines.push(`\n*${book.subtitle}*`)
  lines.push(`\n---\n`)
  if (scope === 'all') {
    lines.push(`**Complete Book** — ${chapters.length} chapters\n`)
  } else if (scope === 'current') {
    lines.push(`**Chapter ${chapters[0]?.number}**: ${chapters[0]?.title}\n`)
  } else {
    lines.push(`**${chapters.length} Selected Chapters**\n`)
  }
  if (book.description) lines.push(`\n${book.description}\n`)
  lines.push(`\n*Exported from Atheneum*\n`)

  // Table of contents (for multi-chapter exports)
  if (chapters.length > 1) {
    lines.push(`\n---\n`)
    lines.push(`## Table of Contents\n`)
    for (const ch of chapters) {
      lines.push(`${ch.number}. **${ch.title}**`)
    }
    lines.push('')
  }

  lines.push(`\n---\n`)
  return lines.join('\n')
}

// Build a cover page div for PDF print
function CoverPage({ book, chapters, scope }: {
  book: any
  chapters: ChapterSummary[]
  scope: ExportScope
}) {
  return (
    <div
      className="export-cover-page"
      style={{
        pageBreakAfter: 'always',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '90vh',
        textAlign: 'center',
        padding: '3rem 2rem',
      }}
    >
      {/* Icon */}
      {book.coverIcon && (
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>{book.coverIcon}</div>
      )}

      {/* Title */}
      <h1
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '3rem',
          fontWeight: 700,
          color: 'var(--ink-primary)',
          margin: '0 0 0.5rem 0',
          lineHeight: 1.2,
        }}
      >
        {book.title}
      </h1>

      {/* Subtitle */}
      {book.subtitle && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1.3rem',
            color: 'var(--ink-secondary)',
            fontStyle: 'italic',
            margin: '0 0 2rem 0',
          }}
        >
          {book.subtitle}
        </p>
      )}

      {/* Divider */}
      <div style={{
        width: '120px',
        height: '2px',
        background: 'var(--ink-faint)',
        margin: '0 0 2rem 0',
      }} />

      {/* Scope indicator */}
      <div style={{
        fontFamily: 'var(--font-ui)',
        fontSize: '0.9rem',
        color: 'var(--ink-secondary)',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        marginBottom: '1.5rem',
      }}>
        {scope === 'all' && `Complete Book — ${chapters.length} Chapters`}
        {scope === 'current' && `Chapter ${chapters[0]?.number}`}
        {scope === 'custom' && `${chapters.length} Selected Chapter${chapters.length > 1 ? 's' : ''}`}
      </div>

      {/* Table of Contents for multi-chapter exports */}
      {chapters.length > 1 && (
        <div style={{
          fontFamily: 'var(--font-body)',
          fontSize: '1rem',
          color: 'var(--ink-secondary)',
          lineHeight: 2.2,
          maxWidth: '400px',
          textAlign: 'left',
          marginTop: '1rem',
        }}>
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.7rem',
            color: 'var(--ink-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '0.5rem',
            textAlign: 'center',
          }}>
            Table of Contents
          </div>
          {chapters.map(ch => (
            <div key={ch.id} style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'baseline',
              borderBottom: '1px dotted var(--ink-faint, #ccc)',
              padding: '0.15rem 0',
            }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.85rem', color: 'var(--ink-faint)', minWidth: '1.5rem' }}>
                {ch.number}.
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '1rem' }}>
                {ch.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Description */}
      {book.description && (
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.95rem',
          color: 'var(--ink-faint)',
          maxWidth: '500px',
          lineHeight: 1.7,
          marginTop: '2rem',
        }}>
          {book.description}
        </p>
      )}

      {/* Footer */}
      <p style={{
        fontFamily: 'var(--font-ui)',
        fontSize: '0.75rem',
        color: 'var(--ink-faint)',
        marginTop: 'auto',
        paddingTop: '3rem',
        letterSpacing: '0.08em',
      }}>
        ATHENEUM
      </p>
    </div>
  )
}

export default function ExportMenu({ bookId, chapterId: _chapterId, book, chapter }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<'format' | 'scope' | 'select'>('format')
  const [format, setFormat] = useState<ExportFormat | null>(null)
  const [, setScope] = useState<ExportScope>('current')
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dropPos, setDropPos] = useState<{ bottom: number; left: number; width: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const printContainerRef = useRef<HTMLDivElement | null>(null)

  const allChapters: ChapterSummary[] = book?.chapters || []

  // Close on click outside (must check both menuRef AND portal dropdownRef)
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      const inMenu = menuRef.current?.contains(target)
      const inDropdown = dropdownRef.current?.contains(target)
      if (!inMenu && !inDropdown) {
        setOpen(false)
        setStep('format')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); setStep('format') }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  const toggleChapter = (id: string) => {
    setSelectedChapters(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const getExportChapters = (exportScope: ExportScope): ChapterSummary[] => {
    if (exportScope === 'current') return allChapters.filter(c => c.id === chapter?.id)
    if (exportScope === 'all') return allChapters
    return allChapters.filter(c => selectedChapters.has(c.id))
  }

  const fetchFullChapters = async (summaries: ChapterSummary[]) => {
    const full = []
    for (const ch of summaries) {
      const data = await fetchJSON<any>(`/books/${bookId}/chapters/${ch.id}`)
      full.push(data)
    }
    return full
  }

  const handleSelectFormat = (f: ExportFormat) => {
    setFormat(f)
    setError(null)
    setStep('scope')
  }

  // Accept scope directly to avoid stale closure issues
  const doExport = async (exportFormat: ExportFormat, exportScope: ExportScope) => {
    if (!book) return
    const chaptersToExport = getExportChapters(exportScope)
    if (chaptersToExport.length === 0) return

    setOpen(false)
    setStep('format')
    setLoading(true)
    setError(null)

    try {
      if (exportFormat === 'pdf') {
        await handlePdfExport(chaptersToExport, exportScope)
      } else if (exportFormat === 'markdown') {
        await handleMarkdownExport(chaptersToExport, exportScope)
      } else if (exportFormat === 'epub') {
        await handleEpubExport(chaptersToExport, exportScope)
      }
    } catch (err: any) {
      setError(err.message || 'Export failed.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleMarkdownExport = async (chapSummaries: ChapterSummary[], exportScope: ExportScope) => {
    const fullChapters = chapSummaries.length === 1 && chapSummaries[0].id === chapter?.id
      ? [chapter]
      : await fetchFullChapters(chapSummaries)

    const cover = buildCoverMarkdown(book, chapSummaries, exportScope)
    const chapMds = fullChapters.map(ch => chapterToMarkdown(ch))
    const fullMd = cover + '\n' + chapMds.join('\n\n---\n\n')

    const filename = exportScope === 'current'
      ? `${slugify(book.title)}-${slugify(chapter.title)}.md`
      : `${slugify(book.title)}.md`

    downloadBlob(new Blob([fullMd], { type: 'text/markdown;charset=utf-8' }), filename)
  }

  const handleEpubExport = async (chapSummaries: ChapterSummary[], exportScope: ExportScope) => {
    const fullChapters = chapSummaries.length === 1 && chapSummaries[0].id === chapter?.id
      ? [chapter]
      : await fetchFullChapters(chapSummaries)

    const blob = await exportToEpub(book, fullChapters)
    const filename = exportScope === 'current'
      ? `${slugify(book.title)}-${slugify(chapter.title)}.epub`
      : `${slugify(book.title)}.epub`

    downloadBlob(blob, filename)
  }

  const handlePdfExport = async (chapSummaries: ChapterSummary[], exportScope: ExportScope) => {
    // ALL exports get a cover page — even single chapter
    const prevTitle = document.title

    if (exportScope === 'current') {
      document.title = `Atheneum — ${book.title} — ${chapter?.title || ''}`

      // Build cover page with plain DOM (synchronous — React render is async and races with print)
      const cover = document.createElement('div')
      cover.id = 'export-cover-inject'
      cover.setAttribute('data-print-cover', 'true')
      cover.className = 'export-cover-page'
      cover.style.cssText = 'page-break-after:always;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:92vh;text-align:center;padding:3rem 2rem;box-sizing:border-box;background:#fefdfb'
      cover.innerHTML = `
        ${book.coverIcon ? `<div style="font-size:4rem;margin-bottom:1.5rem">${book.coverIcon}</div>` : ''}
        <h1 style="font-family:var(--font-heading);font-size:3rem;font-weight:700;color:#1a1a1a;margin:0 0 0.5rem;line-height:1.2">${book.title}</h1>
        ${book.subtitle ? `<p style="font-family:var(--font-body);font-size:1.3rem;color:#5a5a5a;font-style:italic;margin:0 0 2rem">${book.subtitle}</p>` : ''}
        <div style="width:120px;height:2px;background:#ccc;margin:0 auto 2rem auto"></div>
        <div style="font-family:var(--font-ui);font-size:0.85rem;color:#5a5a5a;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:1.5rem">Chapter ${chapSummaries[0]?.number}: ${chapSummaries[0]?.title}</div>
        ${book.description ? `<p style="font-family:var(--font-body);font-size:0.9rem;color:#9a9a9a;max-width:480px;line-height:1.7;margin:2rem auto 0 auto;text-align:center">${book.description}</p>` : ''}
        <div style="flex:1"></div>
        <p style="font-family:var(--font-ui);font-size:0.7rem;color:#bbb;letter-spacing:0.12em;margin:0">ATHENEUM</p>
      `

      // Insert before page content
      const pageContainer = document.querySelector('.page-container')
      if (pageContainer?.parentElement) {
        pageContainer.parentElement.insertBefore(cover, pageContainer)
      } else {
        document.body.prepend(cover)
      }

      // Print synchronously — cover is already in DOM
      window.print()

      // Cleanup after print dialog closes
      setTimeout(() => {
        cover.remove()
        document.title = prevTitle
      }, 1000)
      return
    }

    // Multi-chapter PDF
    const filename = exportScope === 'all'
      ? `Atheneum — ${book.title}`
      : `Atheneum — ${book.title} (Selected)`
    document.title = filename

    // Fetch all chapter data
    const fullChapters = await fetchFullChapters(chapSummaries)

    // Create a print-only container with cover + all chapters
    const container = document.createElement('div')
    container.id = 'export-print-container'
    container.setAttribute('data-print-export', 'true')
    document.body.appendChild(container)
    printContainerRef.current = container

    // Use React to render into the container
    const { createRoot } = await import('react-dom/client')
    const BlockRenderer = (await import('@/components/blocks/BlockRenderer')).default

    const root = createRoot(container)
    root.render(
      <div>
        <CoverPage book={book} chapters={chapSummaries} scope={exportScope} />
        {fullChapters.map((ch, idx) => (
          <div key={ch.id} style={{ pageBreakBefore: idx > 0 ? 'always' : undefined }}>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.75rem',
                color: 'var(--ink-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}>
                Chapter {ch.number}
              </div>
              <h1 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '2.5rem',
                color: 'var(--ink-primary)',
                margin: '0.25rem 0',
              }}>
                {ch.title}
              </h1>
              {ch.subtitle && (
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '1.1rem',
                  color: 'var(--ink-secondary)',
                  fontStyle: 'italic',
                }}>
                  {ch.subtitle}
                </p>
              )}
            </div>
            {(ch.blocks || []).map((block: any) => (
              <BlockRenderer key={block.id} block={block} bookId={bookId} chapterId={ch.id} />
            ))}
          </div>
        ))}
      </div>
    )

    // Wait for render, then print, then cleanup
    await new Promise(r => setTimeout(r, 2000))
    window.print()

    // Cleanup after print dialog
    setTimeout(() => {
      root.unmount()
      container.remove()
      printContainerRef.current = null
      document.title = prevTitle
    }, 1000)
  }

  const btnBase: React.CSSProperties = {
    fontFamily: 'var(--font-ui)',
    fontSize: '0.82rem',
    padding: '0.5rem 0.75rem',
    borderRadius: 4,
    color: 'var(--chrome-text)',
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'color 200ms, background 200ms',
    letterSpacing: '0.01em',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left' as const,
    width: '100%',
  }

  const hoverIn = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.color = 'var(--chrome-hover-text, #f1f5f9)'
    e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
  }
  const hoverOut = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.color = 'var(--chrome-text)'
    e.currentTarget.style.background = 'transparent'
  }

  return (
    <div ref={menuRef} style={{ position: 'relative', overflow: 'visible' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => {
          if (!open) {
            // Compute dropdown position from this button
            const rect = menuRef.current?.getBoundingClientRect()
            if (rect) {
              setDropPos({
                bottom: window.innerHeight - rect.top + 6,
                left: Math.max(8, rect.left),
                width: rect.width,
              })
            }
          }
          setOpen(v => !v)
          setStep('format')
        }}
        style={btnBase}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--chrome-accent)'
          e.currentTarget.style.background = 'rgba(47, 92, 138, 0.06)'
        }}
        onMouseLeave={hoverOut}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Export
        {loading && (
          <span style={{
            width: 12, height: 12,
            border: '2px solid var(--chrome-border)',
            borderTopColor: 'var(--chrome-accent)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginLeft: 'auto',
          }} />
        )}
      </button>

      {error && (
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '0.7rem',
          color: 'var(--color-error, #f87171)', padding: '0.25rem 0.75rem',
        }}>
          {error}
        </div>
      )}

      {/* Dropdown — rendered via portal into document.body to fully escape sidebar overflow/transform clipping */}
      {open && dropPos && createPortal(
        <div ref={dropdownRef} style={{
          position: 'fixed',
          bottom: dropPos.bottom,
          left: dropPos.left,
          width: step === 'select' ? Math.max(300, dropPos.width) : Math.max(220, dropPos.width),
          background: 'var(--chrome-surface)',
          border: '1px solid var(--chrome-border)',
          borderRadius: 8,
          overflow: 'hidden',
          zIndex: 9999,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
          // maxHeight: available space above the trigger = viewport height minus bottom offset minus padding
          maxHeight: step === 'select' ? Math.min(450, window.innerHeight - dropPos.bottom - 16) : undefined,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Step 1: Choose format */}
          {step === 'format' && (
            <>
              <button type="button" onClick={() => handleSelectFormat('pdf')} style={btnBase} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                PDF
              </button>
              <button type="button" onClick={() => handleSelectFormat('markdown')} style={btnBase} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16v16H4z" />
                  <path d="M7 15V9l2.5 3L12 9v6" />
                </svg>
                Markdown
              </button>
              <button type="button" onClick={() => handleSelectFormat('epub')} style={btnBase} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                EPUB
              </button>
            </>
          )}

          {/* Step 2: Choose scope */}
          {step === 'scope' && (
            <>
              <div style={{
                padding: '0.5rem 0.75rem',
                fontFamily: 'var(--font-ui)',
                fontSize: '0.7rem',
                color: 'var(--ink-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                borderBottom: '1px solid var(--chrome-border)',
              }}>
                {format?.toUpperCase()} — What to export?
              </div>
              <button type="button" onClick={() => { if (format) doExport(format, 'current') }} style={btnBase} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                This Chapter
              </button>
              <button type="button" onClick={() => { if (format) doExport(format, 'all') }} style={btnBase} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                Entire Book ({allChapters.length} chapters)
              </button>
              <button type="button" onClick={() => { setScope('custom'); setStep('select'); setSelectedChapters(new Set()) }} style={btnBase} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                Select Chapters...
              </button>
              <div style={{ borderTop: '1px solid var(--chrome-border)' }}>
                <button type="button" onClick={() => setStep('format')} style={{ ...btnBase, fontSize: '0.75rem', color: 'var(--ink-faint)' }} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                  &larr; Back
                </button>
              </div>
            </>
          )}

          {/* Step 3: Select specific chapters — fixed header + scrollable list + sticky footer */}
          {step === 'select' && (
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
              {/* Fixed header */}
              <div style={{
                padding: '0.5rem 0.75rem',
                fontFamily: 'var(--font-ui)',
                fontSize: '0.7rem',
                color: 'var(--ink-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                borderBottom: '1px solid var(--chrome-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0,
              }}>
                <span>Select chapters</span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedChapters.size === allChapters.length) {
                      setSelectedChapters(new Set())
                    } else {
                      setSelectedChapters(new Set(allChapters.map(c => c.id)))
                    }
                  }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)', fontSize: '0.65rem',
                    color: 'var(--chrome-accent)', padding: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedChapters.size === allChapters.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {/* Scrollable chapter list */}
              <div style={{ overflowY: 'auto', maxHeight: '280px', flexShrink: 1 }}>
                {allChapters.map(ch => (
                  <label
                    key={ch.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '0.35rem 0.75rem', cursor: 'pointer',
                      fontFamily: 'var(--font-ui)', fontSize: '0.8rem',
                      color: selectedChapters.has(ch.id) ? 'var(--chrome-hover-text, #f1f5f9)' : 'var(--chrome-text)',
                      background: selectedChapters.has(ch.id) ? 'rgba(47, 92, 138, 0.08)' : 'transparent',
                      transition: 'background 150ms',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedChapters.has(ch.id)}
                      onChange={() => toggleChapter(ch.id)}
                      style={{ accentColor: 'var(--chrome-accent)', flexShrink: 0 }}
                    />
                    <span style={{ opacity: 0.5, minWidth: '1.5em', flexShrink: 0 }}>{ch.number}.</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.title}</span>
                  </label>
                ))}
              </div>

              {/* Sticky footer — ALWAYS visible */}
              <div style={{
                borderTop: '1px solid var(--chrome-border)',
                padding: '0.6rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexShrink: 0,
                background: 'var(--chrome-surface)',
              }}>
                <button type="button" onClick={() => setStep('scope')} style={{
                  ...btnBase, fontSize: '0.75rem', color: 'var(--ink-faint)', width: 'auto', padding: '0.3rem 0.5rem',
                }} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
                  &larr;
                </button>
                <button
                  type="button"
                  disabled={selectedChapters.size === 0}
                  onClick={() => { if (format) doExport(format, 'custom') }}
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: selectedChapters.size > 0 ? '#0a0e17' : 'var(--ink-faint)',
                    background: selectedChapters.size > 0 ? 'var(--chrome-accent, var(--chrome-accent))' : 'transparent',
                    border: selectedChapters.size > 0 ? 'none' : '1px solid var(--chrome-border)',
                    borderRadius: '6px',
                    padding: '0.45rem 1rem',
                    cursor: selectedChapters.size > 0 ? 'pointer' : 'default',
                    opacity: selectedChapters.size > 0 ? 1 : 0.4,
                    transition: 'all 200ms',
                    flex: 1,
                    textAlign: 'center' as const,
                  }}
                >
                  Export {selectedChapters.size} chapter{selectedChapters.size !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
