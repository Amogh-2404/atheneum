import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import type { DiagramBlock as DiagramBlockType } from '@/types'
import { renderText } from '@/lib/render-text'
import ErrorBoundary from './ErrorBoundary'
import '@excalidraw/excalidraw/index.css'

// Lazy-load Excalidraw — only when user opens the interactive modal
const ExcalidrawComponent = lazy(() =>
  import('@excalidraw/excalidraw').then((mod) => ({ default: mod.Excalidraw }))
)

// ─── Static SVG Preview ─────────────────────────────────────────────

function StaticDiagramPreview({
  data,
  onClick,
}: {
  data: Record<string, unknown>
  onClick: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgHtml, setSvgHtml] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    // Use exportToSvg from Excalidraw utils
    import('@excalidraw/excalidraw')
      .then(async (mod) => {
        if (cancelled) return
        const exportToSvg = mod.exportToSvg
        if (!exportToSvg) {
          setError(true)
          return
        }

        try {
          const elements = (data.elements || []) as any[]
          const appState = (data.appState || {}) as any
          const files = (data.files || {}) as any

          const svg = await exportToSvg({
            elements,
            appState: {
              ...appState,
              exportWithDarkMode: false,
              exportBackground: true,
              viewBackgroundColor: appState.viewBackgroundColor || '#ffffff',
            },
            files,
            exportPadding: 20,
          })

          if (!cancelled) {
            // Make SVG responsive
            svg.setAttribute('width', '100%')
            svg.setAttribute('height', '100%')
            svg.style.maxHeight = '450px'
            setSvgHtml(svg.outerHTML)
          }
        } catch (err) {
          console.warn('[DiagramBlock] exportToSvg failed:', err)
          if (!cancelled) setError(true)
        }
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => { cancelled = true }
  }, [data])

  if (error) {
    return <DiagramFallback inlineData={data} />
  }

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      style={{
        cursor: 'pointer',
        position: 'relative',
        borderRadius: 8,
        overflow: 'hidden',
        border: '2px solid var(--ruled-line-color, rgba(140,160,200,0.12))',
        background: '#ffffff',
        transition: 'box-shadow 200ms ease, transform 200ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {svgHtml ? (
        <div
          dangerouslySetInnerHTML={{ __html: svgHtml }}
          style={{ minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        />
      ) : (
        <DiagramSkeleton />
      )}

      {/* "Interactive" badge */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          background: 'rgba(10, 14, 23, 0.85)',
          color: '#52FEFE',
          fontFamily: 'var(--font-ui)',
          fontSize: '0.72rem',
          fontWeight: 600,
          padding: '4px 10px',
          borderRadius: 6,
          letterSpacing: '0.04em',
          backdropFilter: 'blur(8px)',
          opacity: 0.8,
          transition: 'opacity 200ms ease',
          pointerEvents: 'none',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        Click to interact
      </div>
    </div>
  )
}

// ─── Interactive Modal ──────────────────────────────────────────────

function DiagramModal({
  data,
  onClose,
}: {
  data: Record<string, unknown>
  onClose: () => void
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal toolbar */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: 'var(--chrome-bg, #0a0e17)',
          borderBottom: '1px solid var(--chrome-border, #1e293b)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.85rem',
            color: 'var(--chrome-accent, #52FEFE)',
            letterSpacing: '0.04em',
            fontWeight: 600,
          }}
        >
          Interactive Diagram
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid var(--chrome-border, #1e293b)',
            borderRadius: 6,
            color: 'var(--chrome-text, #94a3b8)',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.8rem',
            fontWeight: 600,
            padding: '5px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'background 150ms ease, color 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
            e.currentTarget.style.color = '#f1f5f9'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
            e.currentTarget.style.color = 'var(--chrome-text, #94a3b8)'
          }}
        >
          <kbd style={{ opacity: 0.6, fontSize: '0.7rem' }}>ESC</kbd>
          Close
        </button>
      </div>

      {/* Excalidraw editor */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.05 }}
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          margin: 0,
          background: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <ErrorBoundary fallback={<DiagramFallback inlineData={data} />}>
          <Suspense fallback={<DiagramSkeleton />}>
            <ExcalidrawComponent
              initialData={data}
              viewModeEnabled={false}
              zenModeEnabled={false}
              UIOptions={{
                canvasActions: {
                  export: { saveFileToDisk: true },
                  loadScene: false,
                },
              }}
              theme="light"
            />
          </Suspense>
        </ErrorBoundary>
      </motion.div>
    </motion.div>
  )
}

// ─── Loading skeleton ────────────────────────────────────────────────

function DiagramSkeleton() {
  return (
    <div style={{
      display: 'flex',
      height: '100%',
      minHeight: 200,
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fafafa',
      borderRadius: 8,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#aaa' }}>
        <svg
          style={{ width: 28, height: 28, animation: 'spin 1.5s linear infinite' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
          />
        </svg>
        <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-body)' }}>Rendering diagram...</span>
      </div>
    </div>
  )
}

// ─── Fallback ────────────────────────────────────────────────────────

function DiagramFallback({
  diagramFile,
  inlineData,
}: {
  diagramFile?: string
  inlineData?: unknown
}) {
  const label = diagramFile ?? (inlineData ? 'inline diagram' : 'unknown')
  return (
    <div style={{
      display: 'flex',
      height: '100%',
      minHeight: 200,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      border: '2px dashed #f0c040',
      background: 'rgba(255, 240, 200, 0.15)',
      padding: 24,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#c08020' }}>
        <svg style={{ width: 24, height: 24 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Diagram: {label}</span>
        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Could not render this diagram.</span>
      </div>
    </div>
  )
}

// ─── Main DiagramBlock Component ─────────────────────────────────────

export default function DiagramBlock({
  diagramFile,
  inlineData,
  caption,
  width,
}: DiagramBlockType) {
  const { bookId } = useParams()
  const [diagramData, setDiagramData] = useState<Record<string, unknown> | null>(
    inlineData ? (inlineData as Record<string, unknown>) : null
  )
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!diagramFile && !inlineData)
  const [modalOpen, setModalOpen] = useState(false)

  const widthClass =
    width === 'narrow'
      ? 'max-w-md'
      : width === 'full'
        ? 'max-w-full'
        : 'max-w-2xl'

  // Fetch diagram file if provided
  useEffect(() => {
    if (!diagramFile || inlineData) return

    let cancelled = false
    setLoading(true)
    setFetchError(null)

    const url = bookId
      ? `/content/${bookId}/diagrams/${diagramFile}`
      : `/content/diagrams/${diagramFile}`

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch diagram: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          setDiagramData(data as Record<string, unknown>)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(err.message)
          setLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [diagramFile, inlineData, bookId])

  const openModal = useCallback(() => setModalOpen(true), [])
  const closeModal = useCallback(() => setModalOpen(false), [])

  return (
    <figure className={`my-6 mx-auto ${widthClass}`} style={{ position: 'relative' }}>
      {loading && <DiagramSkeleton />}

      {fetchError && (
        <DiagramFallback diagramFile={diagramFile} inlineData={inlineData} />
      )}

      {!loading && !fetchError && diagramData && (
        <StaticDiagramPreview data={diagramData} onClick={openModal} />
      )}

      {!loading && !fetchError && !diagramData && !diagramFile && !inlineData && (
        <div style={{
          display: 'flex',
          minHeight: 120,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          border: '2px dashed var(--ruled-line-color)',
          padding: 24,
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--ink-faint)' }}>
            No diagram data provided
          </span>
        </div>
      )}

      {caption && (
        <figcaption
          style={{
            marginTop: '0.6rem',
            textAlign: 'center',
            fontFamily: 'var(--font-handwritten)',
            fontSize: '0.95rem',
            color: 'var(--ink-secondary)',
            fontStyle: 'italic',
          }}
        >
          {renderText(caption)}
        </figcaption>
      )}

      {/* Interactive modal */}
      <AnimatePresence>
        {modalOpen && diagramData && (
          <DiagramModal data={diagramData} onClose={closeModal} />
        )}
      </AnimatePresence>
    </figure>
  )
}
