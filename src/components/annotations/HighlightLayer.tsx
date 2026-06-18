import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { offsetsToRange } from '@/lib/block-offsets'
import { annotationStore } from '@/stores/annotationStore'
import type { Highlight } from '@/stores/annotationStore'

// Translucent highlighter inks. mix-blend-mode: multiply makes overlaps darken like real
// ink rather than stacking opaque.
const COLOR_RGBA: Record<string, string> = {
  yellow: 'rgb(250 204 21 / 0.40)',
  green: 'rgb(74 222 128 / 0.38)',
  blue: 'rgb(96 165 250 / 0.38)',
  pink: 'rgb(244 114 182 / 0.36)',
  purple: 'rgb(192 132 252 / 0.38)',
}

type Rect = { id: string; color: string; top: number; left: number; width: number; height: number; fresh: boolean }

// Ids that have already played the ink-in wipe — so a ResizeObserver/font reflow within
// the 1.5s window (or a clock-skewed cross-device arrival) can't replay it mid-read.
const animatedHighlightIds = new Set<string>()

// One-time injected styles: a left-to-right "ink in" wipe for a JUST-created highlight
// (not on reload/repaint), plus a smooth colour morph. Reduced-motion: instant.
let stylesInjected = false
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return
  stylesInjected = true
  const el = document.createElement('style')
  el.textContent = `
    /* Blend per theme: multiply darkens an ink onto light paper; on the DARK theme
       multiply would erase the highlight into the near-black background, so use screen
       (lighten) there. The var lives on <html data-theme> and cascades to every rect. */
    .hl-rect { mix-blend-mode: var(--hl-blend, multiply); transition: background-color 200ms ease; }
    [data-theme="dark"] { --hl-blend: screen; }
    [data-theme="light"], [data-theme="sepia"] { --hl-blend: multiply; }
    @keyframes hl-wipe { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
    .hl-rect.hl-fresh { animation: hl-wipe 320ms cubic-bezier(.22,.61,.36,1); }
    @media (prefers-reduced-motion: reduce) { .hl-rect.hl-fresh { animation: none; } }
  `
  document.head.appendChild(el)
}

/**
 * Paints a book's highlights for ONE block as an absolutely-positioned overlay of rects,
 * computed from a Range reconstructed off the stored {startOffset,endOffset}. React fully
 * owns this layer; we NEVER touch the prose subtree — so a highlight survives every Reader
 * re-render and every Forge rewrite (the clobber race that killed the old <mark> renderer
 * is structurally impossible). The layer is a child of the block's position:relative box,
 * so it tracks the block on scroll for free — no scroll listener, only ResizeObserver +
 * font-load for geometry changes.
 */
export default function HighlightLayer({
  blockEl,
  bookId,
  chapterId,
  blockId,
}: {
  blockEl: HTMLElement | null
  bookId?: string
  chapterId?: string
  blockId: string
}) {
  const all = useSyncExternalStore(annotationStore.subscribe, annotationStore.getSnapshot)
  const annos = useMemo(
    () =>
      all.filter(
        (a): a is Highlight =>
          a.type === 'highlight' && a.bookId === bookId && a.chapterId === chapterId && a.blockId === blockId,
      ),
    [all, bookId, chapterId, blockId],
  )
  const annosRef = useRef(annos)
  annosRef.current = annos
  const [rects, setRects] = useState<Rect[]>([])
  ensureStyles()

  // Stable content signature — the effect re-runs only when THIS block's highlights truly
  // change (not on every store notification), killing the repaint-every-render flicker.
  const sig = annos.map((a) => `${a.id}:${a.startOffset}:${a.endOffset}:${a.color}`).join('|')

  useLayoutEffect(() => {
    function recompute() {
      if (!blockEl) {
        setRects([])
        return
      }
      const box = blockEl.getBoundingClientRect()
      const out: Rect[] = []
      for (const a of annosRef.current) {
        const range = offsetsToRange(blockEl, a.startOffset, a.endOffset)
        if (!range) continue // offsets drifted (content edited) → skip silently, never throw
        const color = COLOR_RGBA[a.color] ?? COLOR_RGBA.yellow
        // Ink-in ONCE: recently created AND not yet animated for this id.
        const fresh = Date.now() - Date.parse(a.createdAt) < 1500 && !animatedHighlightIds.has(a.id)
        if (fresh) animatedHighlightIds.add(a.id)
        for (const r of range.getClientRects()) {
          if (r.width === 0 || r.height === 0) continue
          out.push({
            id: a.id,
            color,
            top: r.top - box.top,
            left: r.left - box.left,
            width: r.width,
            height: r.height,
            fresh,
          })
        }
      }
      setRects(out)
    }

    recompute()
    if (!blockEl) return
    // Geometry-only triggers: width/reflow/content-edit + web-font swap. NO scroll listener.
    const ro = new ResizeObserver(() => recompute())
    ro.observe(blockEl)
    let cancelled = false
    if (document.fonts?.ready) document.fonts.ready.then(() => { if (!cancelled) recompute() })
    return () => {
      cancelled = true
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockEl, sig])

  if (!blockEl || rects.length === 0) return null
  return (
    <>
      {rects.map((r, i) => (
        <div
          key={`${r.id}-${i}`}
          data-highlight-id={r.id}
          aria-hidden
          className={r.fresh ? 'hl-rect hl-fresh' : 'hl-rect'}
          style={{
            position: 'absolute',
            top: r.top,
            left: r.left,
            width: r.width,
            height: r.height,
            background: r.color,
            borderRadius: 3,
            pointerEvents: 'none', // taps pass through to text; tap-to-edit uses caret hit-testing
            transform: 'translateZ(0)',
            willChange: 'transform',
            zIndex: 0, // behind the text, above the block background
          }}
        />
      ))}
    </>
  )
}
