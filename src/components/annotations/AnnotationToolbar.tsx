import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/* ─── Types ────────────────────────────────────────────────────────── */

interface ToolbarState {
  visible: boolean
  x: number
  y: number
  flippedBelow: boolean
  blockId: string
  selectedText: string
  startOffset: number
  endOffset: number
}

interface AnnotationToolbarProps {
  bookId: string
  chapterId: string
  addAnnotation: (annotation: any) => string
  /** Awaited variant — used for confusion markers so a failed server write surfaces. */
  addAnnotationSynced: (annotation: any) => Promise<string>
  contentRef: React.RefObject<HTMLElement | null>
}

/* ─── Highlight colours ────────────────────────────────────────────── */

const COLORS: { key: 'yellow' | 'green' | 'blue' | 'pink' | 'purple'; hex: string }[] = [
  { key: 'yellow', hex: '#FFEB3B' },
  { key: 'green', hex: '#4CAF50' },
  { key: 'blue', hex: '#42A5F5' },
  { key: 'pink', hex: '#EC407A' },
  { key: 'purple', hex: '#9575CD' },
]

/* ─── Helpers ──────────────────────────────────────────────────────── */

/** Walk up from a node to find the closest ancestor with an id attribute */
function findBlockId(node: Node | null): string | null {
  let el: HTMLElement | null =
    node instanceof HTMLElement ? node : node?.parentElement ?? null
  while (el) {
    if (el.id && !el.id.startsWith('__')) return el.id
    el = el.parentElement
  }
  return null
}

/** Compute the text offset of `node` at `offset` relative to `root`'s full text */
function textOffsetInBlock(root: HTMLElement, node: Node, offset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let total = 0
  let current: Node | null
  while ((current = walker.nextNode())) {
    if (current === node) return total + offset
    total += (current.textContent ?? '').length
  }
  return total + offset
}

/* ─── Component ────────────────────────────────────────────────────── */

export default function AnnotationToolbar({
  bookId,
  chapterId,
  addAnnotation,
  addAnnotationSynced,
  contentRef,
}: AnnotationToolbarProps) {
  const [state, setState] = useState<ToolbarState>({
    visible: false,
    x: 0,
    y: 0,
    flippedBelow: false,
    blockId: '',
    selectedText: '',
    startOffset: 0,
    endOffset: 0,
  })

  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText] = useState('')
  // Confusion-marker write lifecycle: idle while not saving, 'saving' during the
  // awaited server write, 'error' if it failed (so the reader sees the failure).
  const [confusionState, setConfusionState] = useState<'idle' | 'saving' | 'error'>('idle')
  const toolbarRef = useRef<HTMLDivElement>(null)
  const noteInputRef = useRef<HTMLTextAreaElement>(null)

  /* ── Show toolbar on text selection ──
     Shared by the mouse path (mouseup) and the touch path (touchend /
     debounced selectionchange). It reads window.getSelection() directly,
     so it is gesture-agnostic — no event object is required. */
  const captureSelection = useCallback(() => {
    // Small delay so the selection is finalised
    requestAnimationFrame(() => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        return
      }

      const range = sel.getRangeAt(0)
      const text = sel.toString().trim()
      if (!text) return

      // Ensure the selection is inside our content area
      const container = contentRef.current
      if (!container || !container.contains(range.commonAncestorContainer)) return

      // Find the block
      const blockId = findBlockId(range.startContainer)
      if (!blockId) return

      const blockEl = document.getElementById(blockId)
      if (!blockEl) return

      const startOff = textOffsetInBlock(blockEl, range.startContainer, range.startOffset)
      const endOff = textOffsetInBlock(blockEl, range.endContainer, range.endOffset)

      // Position toolbar above selection, relative to the content container
      const rect = range.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      // Coordinates relative to the position:relative container
      const rawX = rect.left - containerRect.left + rect.width / 2
      const clampedX = Math.max(20, Math.min(rawX, containerRect.width - 20))

      // If toolbar would appear above the viewport, flip it below the selection
      const aboveY = rect.top - containerRect.top - 8
      const belowY = rect.bottom - containerRect.top + 8
      const flippedBelow = rect.top < 60
      const finalY = flippedBelow ? belowY : aboveY

      setState({
        visible: true,
        x: clampedX,
        y: finalY,
        flippedBelow,
        blockId,
        selectedText: text,
        startOffset: startOff,
        endOffset: endOff,
      })
    })
  }, [contentRef])

  /* ── Hide on click-away or Escape ── */
  const hide = useCallback(() => {
    setState((s) => ({ ...s, visible: false }))
    setShowNoteInput(false)
    setNoteText('')
    setConfusionState('idle')
  }, [])

  useEffect(() => {
    // Dismiss on a press-away — for both mouse (mousedown) and touch
    // (touchstart) so the toolbar closes when a finger taps outside it.
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (
        toolbarRef.current &&
        e.target instanceof Node &&
        !toolbarRef.current.contains(e.target)
      ) {
        // Don't hide immediately — let mouseup/touchend fire first for new
        // selections, then only hide if nothing got selected.
        setTimeout(() => {
          const sel = window.getSelection()
          if (!sel || sel.isCollapsed) hide()
        }, 200)
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') hide()
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [hide])

  /* ── Listen for mouseup on content area (mouse path) ── */
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    el.addEventListener('mouseup', captureSelection)
    return () => el.removeEventListener('mouseup', captureSelection)
  }, [contentRef, captureSelection])

  /* ── Touch path — alongside the mouse path, not a replacement ──
     On touch, 'mouseup' is unreliable, so we listen for 'touchend' and for a
     debounced 'selectionchange' (which fires as the long-press selection
     grows). Both funnel into the same captureSelection body. We also
     preventDefault the long-press once a selection lands inside our content so
     iOS suppresses its native Copy / Look-Up callout and lets our toolbar own
     the gesture. */
  useEffect(() => {
    const el = contentRef.current
    if (!el) return

    // iOS suppresses programmatic/long-press selection unless the element
    // opts in to text selection; -webkit-touch-callout:none stops the native
    // Copy/Look-Up bubble from racing our toolbar. Stash and restore prior
    // values so we don't clobber styles owned elsewhere.
    const style = el.style as CSSStyleDeclaration & { webkitTouchCallout?: string }
    const prevUserSelect = style.webkitUserSelect
    const prevCallout = style.webkitTouchCallout ?? ''
    style.webkitUserSelect = 'text'
    if ('webkitTouchCallout' in style) style.webkitTouchCallout = 'none'

    let debounce: ReturnType<typeof setTimeout> | null = null

    const onTouchEnd = () => captureSelection()

    const onSelectionChange = () => {
      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.rangeCount) return
      // Only react to selections inside our content area.
      if (!el.contains(sel.getRangeAt(0).commonAncestorContainer)) return
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => captureSelection(), 250)
    }

    // Suppress the native callout only when the long-press selection is ours.
    const onContextMenu = (e: Event) => {
      const sel = window.getSelection()
      if (
        sel &&
        !sel.isCollapsed &&
        sel.rangeCount &&
        el.contains(sel.getRangeAt(0).commonAncestorContainer)
      ) {
        e.preventDefault()
      }
    }

    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('selectionchange', onSelectionChange)
    return () => {
      if (debounce) clearTimeout(debounce)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('selectionchange', onSelectionChange)
      style.webkitUserSelect = prevUserSelect
      if ('webkitTouchCallout' in style) style.webkitTouchCallout = prevCallout
    }
  }, [contentRef, captureSelection])

  /* ── Focus note input when opened ── */
  useEffect(() => {
    if (showNoteInput && noteInputRef.current) {
      noteInputRef.current.focus()
    }
  }, [showNoteInput])

  /* ── Actions ── */
  const handleHighlight = (color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple') => {
    addAnnotation({
      type: 'highlight',
      bookId,
      chapterId,
      blockId: state.blockId,
      startOffset: state.startOffset,
      endOffset: state.endOffset,
      selectedText: state.selectedText,
      color,
    })
    window.getSelection()?.removeAllRanges()
    hide()
  }

  const handleConfusion = async () => {
    if (confusionState === 'saving') return
    setConfusionState('saving')
    try {
      // Awaited server write — the optimistic marker rolls back inside the hook
      // if this rejects, so we just surface the failure here.
      await addAnnotationSynced({
        type: 'confusion',
        bookId,
        chapterId,
        blockId: state.blockId,
      })
      window.getSelection()?.removeAllRanges()
      hide()
    } catch {
      // Keep the toolbar open and show the failure so the reader can retry.
      setConfusionState('error')
    }
  }

  const handleNoteSubmit = () => {
    if (!noteText.trim()) return
    addAnnotation({
      type: 'margin-note',
      bookId,
      chapterId,
      blockId: state.blockId,
      text: noteText.trim(),
    })
    window.getSelection()?.removeAllRanges()
    hide()
  }

  const handleBookmark = () => {
    addAnnotation({
      type: 'bookmark',
      bookId,
      chapterId,
      blockId: state.blockId,
      label: state.selectedText.slice(0, 60),
    })
    window.getSelection()?.removeAllRanges()
    hide()
  }

  return (
    <AnimatePresence>
      {state.visible && (
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, scale: 0.85, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 4 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            left: state.x,
            top: state.y,
            transform: state.flippedBelow
              ? 'translate(-50%, 0%)'
              : 'translate(-50%, -100%)',
            zIndex: 100,
            background: 'var(--chrome-surface, #111827)',
            border: '1px solid var(--chrome-border, #1e293b)',
            borderRadius: 20,
            padding: '6px 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            userSelect: 'none',
          }}
        >
          {/* ── Main toolbar row ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Colour circles */}
            {COLORS.map((c) => (
              <button
                type="button"
                key={c.key}
                title={`Highlight ${c.key}`}
                onClick={() => handleHighlight(c.key)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  margin: '-4px -6px',
                }}
                onMouseEnter={(e) => {
                  const circle = e.currentTarget.firstElementChild as HTMLElement
                  if (circle) {
                    circle.style.borderColor = '#fff'
                    circle.style.transform = 'scale(1.2)'
                  }
                }}
                onMouseLeave={(e) => {
                  const circle = e.currentTarget.firstElementChild as HTMLElement
                  if (circle) {
                    circle.style.borderColor = 'transparent'
                    circle.style.transform = 'scale(1)'
                  }
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: c.hex,
                    border: '2px solid transparent',
                    display: 'block',
                    transition: 'border-color 150ms ease, transform 150ms ease',
                    pointerEvents: 'none',
                  }}
                />
              </button>
            ))}

            {/* Divider */}
            <div
              style={{
                width: 1,
                height: 16,
                background: 'var(--chrome-border, #1e293b)',
                margin: '0 2px',
              }}
            />

            {/* Bookmark */}
            <button
              type="button"
              title="Bookmark"
              onClick={handleBookmark}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 10,
                margin: -8,
                display: 'flex',
                alignItems: 'center',
                color: 'var(--chrome-text, #94a3b8)',
                transition: 'color 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--chrome-accent, var(--chrome-accent))'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--chrome-text, #94a3b8)'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>

            {/* Note */}
            <button
              type="button"
              title="Add margin note"
              onClick={() => setShowNoteInput(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 10,
                margin: -8,
                display: 'flex',
                alignItems: 'center',
                color: showNoteInput
                  ? 'var(--chrome-accent, var(--chrome-accent))'
                  : 'var(--chrome-text, #94a3b8)',
                transition: 'color 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--chrome-accent, var(--chrome-accent))'
              }}
              onMouseLeave={(e) => {
                if (!showNoteInput) {
                  e.currentTarget.style.color = 'var(--chrome-text, #94a3b8)'
                }
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </button>

            {/* Confused? */}
            <button
              type="button"
              title={
                confusionState === 'saving'
                  ? 'Saving…'
                  : confusionState === 'error'
                  ? 'Save failed — click to retry'
                  : 'Mark as confusing'
              }
              onClick={handleConfusion}
              disabled={confusionState === 'saving'}
              style={{
                background: 'none',
                border: 'none',
                cursor: confusionState === 'saving' ? 'wait' : 'pointer',
                padding: 10,
                margin: -8,
                display: 'flex',
                alignItems: 'center',
                color:
                  confusionState === 'error'
                    ? 'var(--color-error, #f87171)'
                    : confusionState === 'saving'
                    ? '#f59e0b'
                    : 'var(--chrome-text, #94a3b8)',
                opacity: confusionState === 'saving' ? 0.7 : 1,
                transition: 'color 150ms ease',
              }}
              onMouseEnter={(e) => {
                if (confusionState === 'idle') e.currentTarget.style.color = '#f59e0b'
              }}
              onMouseLeave={(e) => {
                if (confusionState === 'idle')
                  e.currentTarget.style.color = 'var(--chrome-text, #94a3b8)'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>
          </div>

          {/* ── Confusion-write error row ── */}
          {confusionState === 'error' && (
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.72rem',
                color: 'var(--color-error, #f87171)',
                textAlign: 'center',
                lineHeight: 1.3,
                maxWidth: 220,
              }}
            >
              Couldn’t save — check the connection and tap “?” to retry.
            </div>
          )}

          {/* ── Note input row ── */}
          {showNoteInput && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                display: 'flex',
                gap: 4,
                width: '100%',
                minWidth: Math.min(240, window.innerWidth - 48),
                maxWidth: 'calc(100vw - 3rem)',
              }}
            >
              <textarea
                ref={noteInputRef}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleNoteSubmit()
                  }
                }}
                placeholder="Your note..."
                rows={2}
                style={{
                  flex: 1,
                  fontFamily: 'var(--font-handwritten, Caveat, cursive)',
                  fontSize: '0.85rem',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--chrome-border, #1e293b)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  color: 'var(--ink-primary, #e2e2e2)',
                  resize: 'none',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleNoteSubmit}
                disabled={!noteText.trim()}
                style={{
                  background: noteText.trim()
                    ? 'var(--chrome-accent, var(--chrome-accent))'
                    : 'var(--chrome-border, #1e293b)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '0 10px',
                  cursor: noteText.trim() ? 'pointer' : 'default',
                  color: noteText.trim() ? '#0a0e17' : '#666',
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  transition: 'background 150ms ease',
                }}
              >
                Add
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
