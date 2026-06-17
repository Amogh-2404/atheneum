import type { Node, Edge } from '@xyflow/react'

/**
 * The Knowledge Map data layer — meaningful for EVERY book, never empty, never a
 * degenerate single row.
 *
 * Three auto-selected tiers off the one structure every book always has (its
 * ordered chapters = a topological spine):
 *   - 'dag'           : the book declares concept prerequisites -> a real layered
 *                       prerequisite DAG (dagre).
 *   - 'spine-clusters': concepts but no prereq edges (e.g. qualcomm) -> a vertical
 *                       chapter spine with each chapter's concepts clustered in its lane.
 *   - 'spine'         : no concepts (e.g. ti-product-data) -> just the chapter spine,
 *                       each node carrying its title / read-time / learning goal.
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
  estimatedReadMinutes?: number
  blockCount?: number
  estimatedBlocks?: number
  learningGoal?: string
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

export interface ChapterNodeData {
  chapterId: string
  number: number
  title: string
  minutes?: number
  blocks?: number
  goal?: string
  conceptCount: number
  color: string
  [key: string]: unknown
}

export type GraphTier = 'dag' | 'spine-clusters' | 'spine' | 'empty'
export interface BuiltGraph {
  nodes: Node[]
  edges: Edge[]
  tier: GraphTier
  conceptCount: number
  chapterCount: number
}

export const NODE_W = 184
export const NODE_H = 42

// Muted, editorial chapter palette (HSL sat ~30-40%) — the same hues the reader
// uses per chapter, so map-color === reader-color (the section-color law).
export const CHAPTER_COLORS = [
  '#4E6E8E', '#8E6E8E', '#6E8E7A', '#8E7A4E', '#6E7A8E',
  '#8E5E5E', '#5E8E8E', '#7A6E8E', '#8E8E5E', '#5E7A6E',
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

// ── Spine-first layout (Tier A 'spine' + Tier B 'spine-clusters') ──
function buildSpineGraph(outline: OutlineData, order: string[]): BuiltGraph {
  const chapters = outline.chapters || []
  const ci = outline.conceptIndex || {}
  const conceptKeys = Object.keys(ci)
  if (chapters.length === 0) return { nodes: [], edges: [], tier: 'empty', conceptCount: 0, chapterCount: 0 }

  const byChapter = new Map<string, string[]>()
  for (const slug of conceptKeys) {
    const ch = ci[slug].definedIn
    if (!byChapter.has(ch)) byChapter.set(ch, [])
    byChapter.get(ch)!.push(slug)
  }

  const CHAP_X = 0, CHAP_H = 92
  const CONC_X = 340, CONC_W = 188, CONC_H = 46, CONC_GAP = 10, PER_ROW = 4
  const LANE_PAD = 36

  const nodes: Node[] = []
  const edges: Edge[] = []
  let y = 0
  chapters.forEach((ch, i) => {
    const color = getChapterColor(ch.id, order)
    const concepts = byChapter.get(ch.id) || []
    const rows = Math.max(1, Math.ceil(concepts.length / PER_ROW))
    const conceptsH = concepts.length ? rows * (CONC_H + CONC_GAP) : 0
    const laneBody = Math.max(CHAP_H, conceptsH)
    const laneTop = y

    nodes.push({
      id: `ch-${ch.id}`,
      type: 'chapter',
      position: { x: CHAP_X, y: laneTop + (laneBody - CHAP_H) / 2 },
      data: {
        chapterId: ch.id,
        number: ch.number ?? i + 1,
        title: ch.title || ch.id,
        minutes: ch.estimatedReadMinutes,
        blocks: ch.blockCount ?? ch.estimatedBlocks,
        goal: ch.learningGoal,
        conceptCount: concepts.length,
        color,
      } as ChapterNodeData,
    })

    concepts.forEach((slug, k) => {
      const col = k % PER_ROW
      const row = Math.floor(k / PER_ROW)
      nodes.push({
        id: slug,
        type: 'concept',
        position: { x: CONC_X + col * (CONC_W + 10), y: laneTop + row * (CONC_H + CONC_GAP) },
        data: {
          label: humanize(slug),
          chapterId: ch.id,
          chapterTitle: ch.title,
          chapterNumber: ch.number ?? i + 1,
          degree: 0,
          color,
        } as ConceptNodeData,
      })
    })

    if (i < chapters.length - 1) {
      edges.push({ id: `spine-${i}`, source: `ch-${ch.id}`, target: `ch-${chapters[i + 1].id}`, data: { spine: true } })
    }
    y = laneTop + laneBody + LANE_PAD
  })

  return {
    nodes,
    edges,
    tier: conceptKeys.length > 0 ? 'spine-clusters' : 'spine',
    conceptCount: conceptKeys.length,
    chapterCount: chapters.length,
  }
}

// ── Entry: pick the tier ──
export function buildConceptGraph(outline: OutlineData, chapterOrder: string[]): BuiltGraph {
  const ci = outline.conceptIndex || {}
  const keys = Object.keys(ci)
  const chapters = outline.chapters || []

  // Concept-level prerequisite edges (the real, true DAG signal).
  const has = (c: string) => Object.prototype.hasOwnProperty.call(ci, c)
  const edgeMap = new Map<string, Edge>()
  const addEdge = (from: string, to: string) => {
    if (from === to || !has(from) || !has(to)) return
    const id = `${from}__${to}`
    if (!edgeMap.has(id)) edgeMap.set(id, { id, source: from, target: to })
  }
  for (const c of keys) for (const pre of ci[c].prerequisites || []) addEdge(pre, c)
  // Fallback chapter-derived edges ONLY when no concept-level prereqs exist at all.
  if (edgeMap.size === 0) {
    const definedByChapter = new Map<string, string[]>()
    for (const c of keys) {
      const ch = ci[c].definedIn
      if (!definedByChapter.has(ch)) definedByChapter.set(ch, [])
      definedByChapter.get(ch)!.push(c)
    }
    for (const ch of chapters) {
      const defined = definedByChapter.get(ch.id) || []
      for (const pre of ch.prereqs || []) for (const d of defined) addEdge(pre, d)
    }
  }

  // No real edges -> spine-first (never empty, never a single row).
  if (edgeMap.size === 0) return buildSpineGraph(outline, chapterOrder)

  // Real prerequisites exist. Rather than a raw dagre/force hairball — which for
  // 130+ shallow-chained concepts lays out ~10,000px wide and renders as
  // illegible specks — lay the prerequisites OVER the same readable spine-clusters
  // layout. Concepts stay anchored to their chapter; the prerequisite edges become
  // a faint web you trace on hover. Compact and meaningful at any concept count.
  const base = buildSpineGraph(outline, chapterOrder)
  const degree = new Map<string, number>()
  for (const e of edgeMap.values()) {
    degree.set(e.source as string, (degree.get(e.source as string) || 0) + 1)
    degree.set(e.target as string, (degree.get(e.target as string) || 0) + 1)
  }
  for (const n of base.nodes) {
    if (n.type === 'concept') (n.data as ConceptNodeData).degree = degree.get(n.id as string) || 0
  }
  return {
    nodes: base.nodes,
    edges: [...base.edges, ...edgeMap.values()],
    tier: 'dag',
    conceptCount: keys.length,
    chapterCount: chapters.length,
  }
}
