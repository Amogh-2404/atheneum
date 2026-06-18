import { textOffsetInBlock } from '@/lib/block-offsets'

// The overlay rects are pointer-events:none (so text stays selectable), so a tap on a
// highlight is resolved by caret hit-testing: tap point → (textNode, offset) → flat block
// offset → which stored highlight contains it. iOS/WebKit only ships caretRangeFromPoint,
// so the standard caretPositionFromPoint is tried first then it falls back.
function caretFromPoint(x: number, y: number): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y)
    return p ? { node: p.offsetNode, offset: p.offset } : null
  }
  if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y) // iOS / WebKit
    return r ? { node: r.startContainer, offset: r.startOffset } : null
  }
  return null
}

interface HitAnno {
  id: string
  blockId: string
  startOffset: number
  endOffset: number
  priority?: number
}

function probe(x: number, y: number, annos: HitAnno[]): HitAnno | null {
  const caret = caretFromPoint(x, y)
  if (!caret) return null
  let el: Node | null = caret.node
  while (el && !(el instanceof HTMLElement && el.hasAttribute('data-block-id'))) el = el.parentNode
  if (!(el instanceof HTMLElement)) return null
  const blockId = el.getAttribute('data-block-id')!
  const flat = textOffsetInBlock(el, caret.node, caret.offset)
  if (flat == null) return null
  return (
    annos
      .filter((a) => a.blockId === blockId && flat >= a.startOffset && flat < a.endOffset)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0] ?? null
  )
}

/** Resolve the highlight under (x,y): caret hit-test (with ±6px y forgiveness), then a
 *  geometric fallback to the overlay rect under the point — covers inter-line gaps and the
 *  last-glyph edge where caretFromPoint misses. elementsFromPoint returns the rects even
 *  though they are pointer-events:none (it's geometric, not pointer hit-testing). */
export function highlightAtPoint(x: number, y: number, annos: HitAnno[]): HitAnno | null {
  const byCaret = probe(x, y, annos) ?? probe(x, y - 6, annos) ?? probe(x, y + 6, annos)
  if (byCaret) return byCaret
  if (typeof document.elementsFromPoint === 'function') {
    for (const el of document.elementsFromPoint(x, y)) {
      const id = el instanceof HTMLElement ? el.getAttribute('data-highlight-id') : null
      if (id) {
        const a = annos.find((h) => h.id === id)
        if (a) return a
      }
    }
  }
  return null
}
