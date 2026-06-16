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
} from '@xyflow/react'
import type { Node, Edge, NodeProps, NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { fetchJSON } from '@/lib/api'
import {
  buildConceptGraph,
  NODE_W,
  type OutlineData,
  type ConceptNodeData,
} from '@/lib/concept-graph'
import { SkeletonGraph, ShimmerStyle } from '@/components/shared/Skeleton'

// ─── Custom node ──────────────────────────────────────────────────
function ConceptNode({ data, selected }: NodeProps<Node<ConceptNodeData>>) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        width: NODE_W,
        minHeight: 40,
        padding: '8px 12px',
        background: 'var(--chrome-surface)',
        color: 'var(--chrome-text)',
        border: `1px solid ${selected ? data.color : 'var(--chrome-border)'}`,
        borderLeft: `3px solid ${data.color}`,
        borderRadius: 'var(--radius-2)',
        boxShadow: selected ? 'var(--shadow-3)' : 'var(--shadow-1)',
        fontFamily: 'var(--font-ui)',
        fontSize: '0.8rem',
        fontWeight: 600,
        lineHeight: 1.25,
        letterSpacing: '0.01em',
        cursor: 'pointer',
        transition: 'border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)',
      }}
      title={data.chapterTitle ? `Defined in Ch.${data.chapterNumber ?? ''} ${data.chapterTitle}` : undefined}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} isConnectable={false} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.label}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} isConnectable={false} />
    </div>
  )
}

const nodeTypes = { concept: ConceptNode }

const defaultEdgeOptions = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: 'rgba(148,163,184,0.55)' },
  style: { stroke: 'rgba(148,163,184,0.34)', strokeWidth: 1.5 },
}

// ─── Page ─────────────────────────────────────────────────────────
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

  const { nodes, edges } = useMemo(() => {
    if (!outline) return { nodes: [] as Node<ConceptNodeData>[], edges: [] as Edge[] }
    const order = (outline.chapters || []).map((c) => c.id)
    return buildConceptGraph(outline, order)
  }, [outline])

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_e, node) => {
      const chapterId = (node.data as ConceptNodeData)?.chapterId
      if (bookId && chapterId) navigate(`/book/${bookId}/${chapterId}`)
    },
    [bookId, navigate],
  )

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
      {/* Slim header */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
          padding: 'var(--space-4) var(--space-6) var(--space-7)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          background: 'linear-gradient(180deg, var(--chrome-bg) 55%, transparent)',
          pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto' }}>
          <Link
            to={bookId ? `/book/${bookId}` : '/'}
            style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--chrome-muted, var(--ink-faint))', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            &larr; Back to reader
          </Link>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 700, color: 'var(--chrome-accent)', margin: '4px 0 0', lineHeight: 1.1 }}>
            Knowledge Map
          </h1>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--chrome-muted, var(--ink-faint))', marginTop: 4, letterSpacing: '0.03em' }}>
            {nodes.length} concepts · {edges.length} prerequisites · top&#8209;to&#8209;bottom is learning order
          </div>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)' }}>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', color: 'var(--chrome-text)' }}>No concept map yet</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.85rem', color: 'var(--chrome-text)', opacity: 0.6, maxWidth: 360, textAlign: 'center' }}>
            Add definition callouts and chapter prerequisites to weave this book's prerequisite graph.
          </div>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.15}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="rgba(148,163,184,0.10)" />
          <Controls showInteractive={false} position="bottom-right" />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => ((n.data as ConceptNodeData)?.color as string) || '#52FEFE'}
            nodeStrokeColor="transparent"
            maskColor="rgba(10,14,23,0.62)"
            style={{ background: 'var(--chrome-surface)', border: '1px solid var(--chrome-border)', borderRadius: 'var(--radius-2)' }}
          />
        </ReactFlow>
      )}
    </div>
  )
}
