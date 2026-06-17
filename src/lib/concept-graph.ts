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
  /** how many other concepts depend on this one (out-degree) — its foundational-ness */
  dependents: number
  /** prerequisite depth: longest chain of prereqs beneath it (0 = foundational) */
  depth: number
  color: string
  width: number
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
  width: number
  [key: string]: unknown
}

/** Responsive layout shape — chosen from viewport width by pickLayout(). */
export interface LayoutOpts {
  /** 'lanes' = chapter on the left, concepts gridded to its right (desktop).
   *  'stack' = chapter full-width on top, concepts gridded below (phones). */
  mode: 'lanes' | 'stack'
  chapterW: number
  conceptW: number
  conceptH: number
  cols: number
  /** gap between grid cells */
  cell: number
  /** vertical gap between chapter lanes/blocks */
  lanePad: number
}

const LANES: LayoutOpts = { mode: 'lanes', chapterW: 296, conceptW: 188, conceptH: 46, cols: 4, cell: 12, lanePad: 40 }

export function pickLayout(width: number): LayoutOpts {
  if (width < 560) return { mode: 'stack', chapterW: 312, conceptW: 151, conceptH: 46, cols: 2, cell: 10, lanePad: 30 }
  if (width < 900) return { mode: 'stack', chapterW: 468, conceptW: 150, conceptH: 46, cols: 3, cell: 11, lanePad: 32 }
  return LANES
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
// Responsive: 'lanes' (chapter left, concepts right) on desktop, 'stack' (chapter
// on top, concepts below) on phones. When prereq edges exist, concepts within a
// chapter are sorted foundational-first (most-depended-on at the top of the cluster).
interface SpineExtras {
  dependents?: Map<string, number>
  depth?: Map<string, number>
}
function buildSpineGraph(
  outline: OutlineData,
  order: string[],
  L: LayoutOpts = LANES,
  extra: SpineExtras = {},
): BuiltGraph {
  const chapters = outline.chapters || []
  const ci = outline.conceptIndex || {}
  const conceptKeys = Object.keys(ci)
  if (chapters.length === 0) return { nodes: [], edges: [], tier: 'empty', conceptCount: 0, chapterCount: 0 }

  const dep = extra.dependents
  const byChapter = new Map<string, string[]>()
  for (const slug of conceptKeys) {
    const ch = ci[slug].definedIn
    if (!byChapter.has(ch)) byChapter.set(ch, [])
    byChapter.get(ch)!.push(slug)
  }
  // foundational concepts first within each cluster (only meaningful when we have edges)
  if (dep) {
    for (const list of byChapter.values()) {
      list.sort((a, b) => (dep.get(b) || 0) - (dep.get(a) || 0) || a.localeCompare(b))
    }
  }

  const CHAP_H = 96
  const { mode, chapterW, conceptW, conceptH, cols, cell, lanePad } = L
  const gridW = cols * conceptW + (cols - 1) * cell
  const concX = mode === 'lanes' ? chapterW + 44 : 0 // lanes: concepts to the right; stack: under the chapter

  const nodes: Node[] = []
  const edges: Edge[] = []
  let y = 0
  chapters.forEach((ch, i) => {
    const color = getChapterColor(ch.id, order)
    const concepts = byChapter.get(ch.id) || []
    const rows = Math.ceil(concepts.length / cols)
    const conceptsH = concepts.length ? rows * (conceptH + cell) - cell : 0

    let chapterY: number
    let gridTop: number
    let laneBody: number
    if (mode === 'lanes') {
      laneBody = Math.max(CHAP_H, conceptsH)
      chapterY = y + (laneBody - CHAP_H) / 2
      gridTop = y
    } else {
      // stack: chapter card on top, grid below
      chapterY = y
      gridTop = y + CHAP_H + 16
      laneBody = CHAP_H + (conceptsH ? 16 + conceptsH : 0)
    }

    nodes.push({
      id: `ch-${ch.id}`,
      type: 'chapter',
      position: { x: 0, y: chapterY },
      data: {
        chapterId: ch.id,
        number: ch.number ?? i + 1,
        title: ch.title || ch.id,
        minutes: ch.estimatedReadMinutes,
        blocks: ch.blockCount ?? ch.estimatedBlocks,
        goal: ch.learningGoal,
        conceptCount: concepts.length,
        color,
        width: mode === 'stack' ? Math.max(chapterW, gridW) : chapterW,
      } as ChapterNodeData,
    })

    concepts.forEach((slug, k) => {
      const col = k % cols
      const row = Math.floor(k / cols)
      nodes.push({
        id: slug,
        type: 'concept',
        position: { x: concX + col * (conceptW + cell), y: gridTop + row * (conceptH + cell) },
        data: {
          label: humanize(slug),
          chapterId: ch.id,
          chapterTitle: ch.title,
          chapterNumber: ch.number ?? i + 1,
          degree: 0,
          dependents: dep?.get(slug) || 0,
          depth: extra.depth?.get(slug) || 0,
          color,
          width: conceptW,
        } as ConceptNodeData,
      })
    })

    if (i < chapters.length - 1) {
      edges.push({ id: `spine-${i}`, source: `ch-${ch.id}`, target: `ch-${chapters[i + 1].id}`, data: { spine: true } })
    }
    y += laneBody + lanePad
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
export function buildConceptGraph(
  outline: OutlineData,
  chapterOrder: string[],
  layout: LayoutOpts = LANES,
): BuiltGraph {
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
  if (edgeMap.size === 0) return buildSpineGraph(outline, chapterOrder, layout)

  // Real prerequisites exist. Rather than a raw dagre/force hairball — which for
  // 130+ shallow-chained concepts lays out ~10,000px wide and renders as
  // illegible specks — lay the prerequisites OVER the readable spine-clusters
  // layout. Concepts stay anchored to their chapter, sorted foundational-first;
  // the prerequisite edges are the dependency structure you trace on hover/focus.
  const edgesArr = [...edgeMap.values()]
  // degree = total connections; dependents = out-degree (how many require THIS
  // concept = how foundational it is); depth = longest prerequisite chain beneath it.
  const degree = new Map<string, number>()
  const dependents = new Map<string, number>()
  const incoming = new Map<string, string[]>()
  for (const e of edgesArr) {
    const s = e.source as string, t = e.target as string
    degree.set(s, (degree.get(s) || 0) + 1)
    degree.set(t, (degree.get(t) || 0) + 1)
    dependents.set(s, (dependents.get(s) || 0) + 1) // s is a prerequisite of t
    if (!incoming.has(t)) incoming.set(t, [])
    incoming.get(t)!.push(s)
  }
  // prerequisite depth via memoized DFS over the prereq (incoming) edges
  const depth = new Map<string, number>()
  const seen = new Set<string>()
  const computeDepth = (n: string): number => {
    if (depth.has(n)) return depth.get(n)!
    if (seen.has(n)) return 0 // cycle guard
    seen.add(n)
    let d = 0
    for (const p of incoming.get(n) || []) d = Math.max(d, 1 + computeDepth(p))
    depth.set(n, d)
    return d
  }
  for (const k of keys) computeDepth(k)

  const base = buildSpineGraph(outline, chapterOrder, layout, { dependents, depth })
  for (const n of base.nodes) {
    if (n.type === 'concept') {
      const d = n.data as ConceptNodeData
      d.degree = degree.get(n.id as string) || 0
      d.dependents = dependents.get(n.id as string) || 0
      d.depth = depth.get(n.id as string) || 0
    }
  }
  return {
    nodes: base.nodes,
    edges: [...base.edges, ...edgesArr],
    tier: 'dag',
    conceptCount: keys.length,
    chapterCount: chapters.length,
  }
}
