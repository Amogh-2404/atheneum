import { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useStore,
} from '@xyflow/react'
import type { Node, Edge, NodeProps, NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { fetchJSON } from '@/lib/api'
import {
  buildConceptGraph,
  NODE_W,
  type OutlineData,
  type ConceptNodeData,
  type ChapterNodeData,
  type GraphTier,
} from '@/lib/concept-graph'
import { SkeletonGraph, ShimmerStyle } from '@/components/shared/Skeleton'

// ─── Concept node ─────────────────────────────────────────────────
function ConceptNode({ data, selected }: NodeProps<Node<ConceptNodeData>>) {
  const zoom = useStore((s) => s.transform[2])
  const showLabel = zoom >= 0.42
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', width: NODE_W, minHeight: 40, padding: '8px 12px',
        background: 'var(--chrome-surface)', color: 'var(--chrome-text)',
        border: `1px solid ${selected ? data.color : 'var(--chrome-border)'}`,
        borderLeft: `3px solid ${data.color}`, borderRadius: 'var(--radius-2)',
        boxShadow: selected ? 'var(--shadow-3)' : 'var(--shadow-1)',
        fontFamily: 'var(--font-ui)', fontSize: '0.8rem', fontWeight: 500, lineHeight: 1.25, cursor: 'pointer',
        transition: 'border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)',
      }}
      title={data.chapterTitle ? `Defined in Ch.${data.chapterNumber ?? ''} ${data.chapterTitle}` : undefined}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} isConnectable={false} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: showLabel ? 1 : 0, transition: 'opacity 120ms ease' }}>{data.label}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} isConnectable={false} />
    </div>
  )
}

// ─── Chapter node (the spine) ─────────────────────────────────────
function ChapterNode({ data }: NodeProps<Node<ChapterNodeData>>) {
  return (
    <div
      title={data.goal}
      style={{
        width: 250, padding: '12px 16px',
        background: 'var(--chrome-surface)', border: '1px solid var(--chrome-border)',
        borderLeft: `3px solid ${data.color}`, borderRadius: 'var(--radius-3)',
        boxShadow: 'var(--shadow-1)', cursor: 'pointer',
        transition: 'box-shadow var(--duration-fast) var(--ease-standard)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} isConnectable={false} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.09em', color: data.color, textTransform: 'uppercase' }}>Ch {data.number}</span>
        {data.minutes != null && (
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-ui)', fontSize: '0.6rem', color: 'var(--chrome-text)', opacity: 0.55, fontVariantNumeric: 'tabular-nums' }}>{data.minutes} min</span>
        )}
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 600, color: 'var(--chrome-hover-text)', lineHeight: 1.22, margin: '5px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{data.title}</div>
      {data.conceptCount > 0 && (
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.62rem', color: 'var(--chrome-text)', opacity: 0.5, marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>{data.conceptCount} concepts</div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} isConnectable={false} />
    </div>
  )
}

const nodeTypes = { concept: ConceptNode, chapter: ChapterNode }

const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: 'rgba(148,163,184,0.55)' },
  style: { stroke: 'rgba(148,163,184,0.34)', strokeWidth: 1.5 },
}

export default function KnowledgeGraph() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const [outline, setOutline] = useState<OutlineData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!bookId) return
    let cancelled = false
    setLoading(true)
    fetchJSON<OutlineData>(`/books/${bookId}/outline`)
      .then((data) => { if (!cancelled) { setOutline(data); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [bookId])

  const { nodes, edges, tier, conceptCount, chapterCount } = useMemo(() => {
    if (!outline) return { nodes: [] as Node[], edges: [] as Edge[], tier: 'empty' as GraphTier, conceptCount: 0, chapterCount: 0 }
    const order = (outline.chapters || []).map((c) => c.id)
    return buildConceptGraph(outline, order)
  }, [outline])

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_e, node) => {
      const chapterId = (node.data as { chapterId?: string })?.chapterId
      if (bookId && chapterId) navigate(`/book/${bookId}/${chapterId}`)
    },
    [bookId, navigate],
  )

  // Hover-chain highlight — DAG tier only (spine has no prerequisite meaning to trace).
  const [hovered, setHovered] = useState<string | null>(null)
  const adj = useMemo(() => {
    const incoming = new Map<string, string[]>()
    const outgoing = new Map<string, string[]>()
    for (const e of edges) {
      if ((e.data as { spine?: boolean })?.spine) continue
      if (!incoming.has(e.target)) incoming.set(e.target, [])
      incoming.get(e.target)!.push(e.source)
      if (!outgoing.has(e.source)) outgoing.set(e.source, [])
      outgoing.get(e.source)!.push(e.target)
    }
    return { incoming, outgoing }
  }, [edges])
  const highlighted = useMemo(() => {
    if (!hovered || tier !== 'dag') return null
    const set = new Set<string>([hovered])
    const stack = [hovered]
    while (stack.length) {
      const n = stack.pop()!
      for (const p of adj.incoming.get(n) || []) if (!set.has(p)) { set.add(p); stack.push(p) }
    }
    for (const d of adj.outgoing.get(hovered) || []) set.add(d)
    return set
  }, [hovered, adj, tier])

  const displayNodes = useMemo(
    () => nodes.map((n) => ({ ...n, style: { opacity: highlighted && !highlighted.has(n.id) ? 0.12 : 1, transition: 'opacity 160ms ease' } })),
    [nodes, highlighted],
  )
  const displayEdges = useMemo(
    () => edges.map((e) => {
      if ((e.data as { spine?: boolean })?.spine) {
        return { ...e, type: 'smoothstep', markerEnd: undefined, style: { stroke: 'var(--chrome-accent)', strokeWidth: 2, opacity: highlighted ? 0.18 : 0.5 } }
      }
      // Resting: prerequisites are a faint web — present, never a tangle. Hover a
      // concept to light its prerequisite chain and dim everything else away.
      if (!highlighted) {
        return { ...e, type: 'smoothstep', markerEnd: undefined, style: { stroke: 'rgba(148,163,184,0.34)', strokeWidth: 1, opacity: 0.1 } }
      }
      const on = highlighted.has(e.source) && highlighted.has(e.target)
      return { ...e, type: 'smoothstep', markerEnd: undefined, style: { stroke: on ? 'var(--chrome-accent)' : 'rgba(148,163,184,0.34)', strokeWidth: on ? 2 : 1, opacity: on ? 0.95 : 0.04 } }
    }),
    [edges, highlighted],
  )
  const onNodeMouseEnter = useCallback<NodeMouseHandler>((_e, node) => setHovered(node.id), [])
  const onNodeMouseLeave = useCallback(() => setHovered(null), [])

  // The spine is a vertical column — short for a 3-chapter book, ~9000px tall for a
  // 100-chapter one. fitView-all would zoom a long spine down to an unreadable
  // thread. Instead we anchor at the TOP and fit the WIDTH: every map opens reading
  // "here's chapter one, scroll down through the book," legibly, at any length.
  const initialViewport = useMemo(() => {
    if (!nodes.length) return { x: 0, y: 0, zoom: 1 }
    let minX = Infinity, maxX = -Infinity, minY = Infinity
    for (const n of nodes) {
      const w = n.type === 'chapter' ? 250 : NODE_W
      minX = Math.min(minX, n.position.x)
      maxX = Math.max(maxX, n.position.x + w)
      minY = Math.min(minY, n.position.y)
    }
    const graphW = maxX - minX
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1440
    const zoom = Math.min(0.85, Math.max(0.42, (vw - 140) / graphW))
    const x = (vw - graphW * zoom) / 2 - minX * zoom
    const y = 150 - minY * zoom // clear the masthead, start at the first chapter
    return { x, y, zoom }
  }, [nodes])

  const prereqCount = useMemo(() => edges.filter((e) => !(e.data as { spine?: boolean })?.spine).length, [edges])
  const subtitle =
    tier === 'dag' ? `${chapterCount} chapters · ${conceptCount} concepts · ${prereqCount} prerequisite links — hover to trace`
    : tier === 'spine-clusters' ? `${chapterCount} chapters · ${conceptCount} concepts · top-to-bottom is reading order`
    : `${chapterCount} chapters · top-to-bottom is reading order`

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--chrome-bg)' }}>
        <ShimmerStyle />
        <SkeletonGraph />
      </div>
    )
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'var(--chrome-bg)', position: 'relative' }}>
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
          padding: 'var(--space-4) var(--space-6) var(--space-7)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          background: 'linear-gradient(180deg, var(--chrome-bg) 55%, transparent)', pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <Link to={bookId ? `/book/${bookId}` : '/'} style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '0.68rem', color: 'var(--chrome-text)', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>
            &larr; Back to reader
          </Link>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 600, color: 'var(--chrome-hover-text)', margin: '4px 0 0', lineHeight: 1.1 }}>
            Knowledge Map
          </h1>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--chrome-text)', marginTop: 4, letterSpacing: '0.02em', opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>
            {subtitle}
          </div>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', color: 'var(--chrome-hover-text)' }}>This book has no chapters yet</div>
        </div>
      ) : (
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          defaultViewport={initialViewport}
          minZoom={0.08}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="rgba(148,163,184,0.10)" />
          <Controls showInteractive={false} position="bottom-right" />
          <MiniMap
            pannable zoomable
            nodeColor={(n) => ((n.data as { color?: string })?.color as string) || '#4E6E8E'}
            nodeStrokeColor="transparent"
            maskColor="rgba(10,14,23,0.62)"
            style={{ background: 'var(--chrome-surface)', border: '1px solid var(--chrome-border)', borderRadius: 'var(--radius-2)' }}
          />
        </ReactFlow>
      )}
    </div>
  )
}
