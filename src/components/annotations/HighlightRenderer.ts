import { useEffect } from 'react'
import type { Highlight } from '@/hooks/useAnnotations'

/* ─── Colour palette (translucent for layering over text) ─────────── */

const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: 'rgba(255, 235, 59, 0.35)',
  green: 'rgba(76, 175, 80, 0.28)',
  blue: 'rgba(66, 165, 245, 0.28)',
  pink: 'rgba(236, 64, 122, 0.25)',
  purple: 'rgba(149, 117, 205, 0.28)',
}

/* ─── DOM manipulation helpers ─────────────────────────────────────── */

/**
 * Walk text nodes inside `root`, find the first occurrence of `text`,
 * and wrap it in a <mark> element.
 */
function highlightTextInElement(
  root: HTMLElement,
  text: string,
  color: string,
  id: string
) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Text | null
  // We may need to search across adjacent text nodes, but for most
  // blocks the full selectedText lives in a single text node.
  while ((node = walker.nextNode() as Text | null)) {
    const content = node.textContent ?? ''
    const idx = content.indexOf(text)
    if (idx === -1) continue

    const range = document.createRange()
    range.setStart(node, idx)
    range.setEnd(node, idx + text.length)

    const mark = document.createElement('mark')
    mark.setAttribute('data-highlight-id', id)
    mark.style.background = HIGHLIGHT_COLORS[color] ?? HIGHLIGHT_COLORS.yellow
    mark.style.borderRadius = '2px'
    mark.style.padding = '0 1px'
    mark.style.cursor = 'pointer'

    try {
      range.surroundContents(mark)
    } catch {
      // surroundContents throws if the range crosses element boundaries.
      // Fall back to extracting + re-inserting.
      const fragment = range.extractContents()
      mark.appendChild(fragment)
      range.insertNode(mark)
    }
    break // only the first occurrence per block
  }
}

/**
 * Remove every <mark data-highlight-id> from the document,
 * restoring the original text nodes.
 */
function clearAllHighlightMarks() {
  document
    .querySelectorAll('mark[data-highlight-id]')
    .forEach((el) => {
      const parent = el.parentNode
      if (!parent) return
      // Replace mark with its text content
      const textNode = document.createTextNode(el.textContent ?? '')
      parent.replaceChild(textNode, el)
      parent.normalize() // merge adjacent text nodes
    })
}

/* ─── Hook ─────────────────────────────────────────────────────────── */

/**
 * After every render, applies <mark> wrappers for each highlight
 * in the current chapter. Cleans up on un-mount or when highlights change.
 */
export function useHighlightRenderer(
  highlights: Highlight[],
  onClickHighlight?: (id: string) => void
) {
  useEffect(() => {
    // Clear previous marks before re-applying
    clearAllHighlightMarks()

    // Apply each highlight
    for (const h of highlights) {
      const blockEl = document.getElementById(h.blockId)
      if (!blockEl) continue
      highlightTextInElement(blockEl, h.selectedText, h.color, h.id)
    }

    // Attach click handlers for removing highlights
    if (onClickHighlight) {
      const handler = (e: Event) => {
        const target = e.target as HTMLElement
        const mark = target.closest('mark[data-highlight-id]')
        if (mark) {
          const hId = mark.getAttribute('data-highlight-id')
          if (hId) onClickHighlight(hId)
        }
      }
      document.addEventListener('click', handler)
      return () => {
        document.removeEventListener('click', handler)
        clearAllHighlightMarks()
      }
    }

    return () => {
      clearAllHighlightMarks()
    }
  }, [highlights, onClickHighlight])
}

export { HIGHLIGHT_COLORS }
