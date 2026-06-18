// The single source of truth for mapping between a block's flat character offsets
// (indices into blockEl.textContent) and DOM positions. Capture (selection → offsets)
// and render/hit-test (offsets → Range) live here together so they can never drift —
// that asymmetry was the original highlight bug. Both walk Text nodes in document order,
// crossing inline children (<strong>/<em>/<code>/<span data-concept>), so a phrase that
// spans a bolded term resolves correctly — which indexOf could never do.

/**
 * Render side: flat char offsets → a DOM Range, crossing inline children.
 * Returns null if the block is shorter than expected (content drifted) so the caller
 * SKIPS rather than throws.
 *
 * Boundary semantics (getting this wrong drops one-char ranges or boundary-aligned ends):
 *   - start is an inclusive cursor — it must sit BEFORE a char:  startChar <  nodeEnd
 *   - end is exclusive — it may sit ON a node boundary:          endChar  <= nodeEnd
 */
export function offsetsToRange(
  blockEl: HTMLElement,
  startChar: number,
  endChar: number,
): Range | null {
  if (startChar >= endChar) return null
  const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT, null)
  let seen = 0
  let startNode: Text | null = null
  let startNodeOffset = 0
  let endNode: Text | null = null
  let endNodeOffset = 0
  let node = walker.nextNode() as Text | null
  while (node) {
    const len = node.data.length
    const nodeStart = seen
    const nodeEnd = seen + len
    if (startNode === null && startChar >= nodeStart && startChar < nodeEnd) {
      startNode = node
      startNodeOffset = startChar - nodeStart
    }
    if (endNode === null && endChar > nodeStart && endChar <= nodeEnd) {
      endNode = node
      endNodeOffset = endChar - nodeStart
    }
    if (startNode && endNode) break
    seen = nodeEnd
    node = walker.nextNode() as Text | null
  }
  if (!startNode || !endNode) return null // offsets out of range → content drifted
  const range = document.createRange()
  range.setStart(startNode, startNodeOffset)
  range.setEnd(endNode, endNodeOffset)
  return range
}

/**
 * Capture side: a Range boundary (container, nodeOffset) → flat char offset within the
 * block's textContent. Works whether the boundary container is a Text node (the common
 * case) OR an Element node — triple-click selects a whole paragraph and a double-click can
 * land the boundary on an inline-element edge, both of which give an ELEMENT container; the
 * old text-only walk returned null for those, so the toolbar never appeared. A Range from
 * the block's content-start to the boundary measures the leading text in the SAME char
 * space that offsetsToRange consumes (both are DOM text-node data, not rendered text).
 * Returns null if the boundary isn't inside the block.
 */
export function textOffsetInBlock(
  blockEl: HTMLElement,
  target: Node,
  nodeOffset: number,
): number | null {
  if (target !== blockEl && !blockEl.contains(target)) return null
  try {
    const r = document.createRange()
    r.selectNodeContents(blockEl)
    r.setEnd(target, nodeOffset)
    return r.toString().length
  } catch {
    return null
  }
}
