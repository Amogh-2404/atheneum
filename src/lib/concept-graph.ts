import dagre from '@dagrejs/dagre'
import type { Node, Edge } from '@xyflow/react'

/**
 * Builds a LEGIBLE concept graph from the author-curated dependency data in
 * outline.json — the data the old graph threw away while reconstructing a worse
 * one from co-mention fan-out + author-order chains.
 *
 * Edges are directed and TRUE:
 *   - concept-level: conceptIndex[c].prerequisites  (prereq -> c)
 *   - chapter-level: each chapter's prereq concept -> each concept that chapter
 *     defines (fills the dependency structure for books whose concept-level
 *     prerequisites are sparse)
 * No co-occurrence fan-out, no same-chapter chains. Fewer, truer edges — laid
 * out top-to-bottom by dagre so the graph reads as learning order.
 */

export interface OutlineConcept {
  definedIn: string
  referencedIn?: string[]
  prerequisites?: string[]
}
export interface OutlineChapter {
  id: string
  title?: string
  number?: number
  concepts?: string[]
  prereqs?: string[]
}
export interface OutlineData {
  conceptIndex?: Record<string, OutlineConcept>
  chapters?: OutlineChapter[]
}

export interface ConceptNodeData {
  label: string
  chapterId: string
  chapterTitle?: string
  chapterNumber?: number
  degree: number
  color: string
  [key: string]: unknown
}

export const NODE_W = 184
export const NODE_H = 42

export const CHAPTER_COLORS = [
  'var(--chrome-accent)', '#f472b6', '#a78bfa', '#34d399', '#fbbf24',
  '#fb923c', '#60a5fa', '#e879f9', '#4ade80', '#f87171',
]

export function getChapterColor(chapterId: string, order: string[]): string {
  const i = order.indexOf(chapterId)
  return CHAPTER_COLORS[(i < 0 ? 0 : i) % CHAPTER_COLORS.length]
}

function humanize(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

export function buildConceptGraph(
  outline: OutlineData,
  chapterOrder: string[],
): { nodes: Node<ConceptNodeData>[]; edges: Edge[] } {
  const ci = outline.conceptIndex || {}
  const chapters = outline.chapters || []
  const keys = Object.keys(ci)
  if (keys.length === 0) return { nodes: [], edges: [] }

  const has = (c: string) => Object.prototype.hasOwnProperty.call(ci, c)

  // ── Directed prereq edges, deduped (strongest signal only) ──
  const edgeMap = new Map<string, Edge>()
  const addEdge = (from: string, to: string) => {
    if (from === to || !has(from) || !has(to)) return
    const id = `${from}__${to}`
    if (!edgeMap.has(id)) edgeMap.set(id, { id, source: from, target: to })
  }

  const definedByChapter = new Map<string, string[]>()
  for (const c of keys) {
    const ch = ci[c].definedIn
    if (!definedByChapter.has(ch)) definedByChapter.set(ch, [])
    definedByChapter.get(ch)!.push(c)
  }

  // Primary: hand-authored concept-level prerequisites (the clean, true DAG).
  for (const c of keys) {
    for (const pre of ci[c].prerequisites || []) addEdge(pre, c)
  }
  // Fallback ONLY when a book declares no concept-level prereqs at all. Connecting
  // a chapter's prereq to EVERY concept it defines fans out, so we never mix it in
  // with real concept prereqs — that mixing blew silicon-data-stack to 524 edges.
  if (edgeMap.size === 0) {
    for (const ch of chapters) {
      const defined = definedByChapter.get(ch.id) || []
      for (const pre of ch.prereqs || []) {
        for (const d of defined) addEdge(pre, d)
      }
    }
  }

  // ── Degree (in + out) for emphasis ──
  const degree = new Map<string, number>()
  for (const e of edgeMap.values()) {
    degree.set(e.source, (degree.get(e.source) || 0) + 1)
    degree.set(e.target, (degree.get(e.target) || 0) + 1)
  }

  const chMeta = new Map(chapters.map((c) => [c.id, c]))

  const nodes: Node<ConceptNodeData>[] = keys.map((c) => {
    const ch = chMeta.get(ci[c].definedIn)
    return {
      id: c,
      type: 'concept',
      position: { x: 0, y: 0 },
      data: {
        label: humanize(c),
        chapterId: ci[c].definedIn,
        chapterTitle: ch?.title,
        chapterNumber: ch?.number,
        degree: degree.get(c) || 0,
        color: getChapterColor(ci[c].definedIn, chapterOrder),
      },
    }
  })

  // ── dagre top-to-bottom layout (= learning order) ──
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 30, ranksep: 70, marginx: 48, marginy: 48 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H })
  for (const e of edgeMap.values()) g.setEdge(e.source, e.target)
  dagre.layout(g)
  for (const n of nodes) {
    const p = g.node(n.id)
    if (p) n.position = { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 }
  }

  return { nodes, edges: [...edgeMap.values()] }
}
