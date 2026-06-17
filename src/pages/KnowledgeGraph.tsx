import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  useStore,
} from '@xyflow/react'
import type { Node, Edge, NodeProps, ReactFlowInstance } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, X, BookOpen, GitFork, CornerDownRight, Layers } from 'lucide-react'
import { spring } from '@/lib/motion'
import { fetchJSON } from '@/lib/api'
import {
  buildConceptGraph,
  pickLayout,
  type OutlineData,
  type ConceptNodeData,
  type ChapterNodeData,
  type GraphTier,
} from '@/lib/concept-graph'
import { SkeletonGraph, ShimmerStyle } from '@/components/shared/Skeleton'

// Node clicks are handled intrinsically (React Flow v12's onNodeClick proved
// unreliable here — it never fired), so the nodes reach their handlers through
// this context instead.
// ─── Concept node ─────────────────────────────────────────────────
// Visual weight encodes how FOUNDATIONAL a concept is (how many others depend on
// it). A keystone concept the whole book rests on is unmistakably heavier than a
// leaf mentioned once — the signal a flat flow chart can never give you.
function ConceptNode({ data, selected }: NodeProps<Node<ConceptNodeData>>) {
  const zoom = useStore((s) => s.transform[2])
  const showLabel = zoom >= 0.4
  const dep = data.dependents ?? 0
  // foundational tiers from out-degree
  const tier = dep >= 6 ? 3 : dep >= 3 ? 2 : dep >= 1 ? 1 : 0
  const weight = [450, 540, 620, 700][tier]
  const bar = [3, 3, 4, 5][tier]
  const ring = tier === 3
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 6, width: data.width, minHeight: 40, padding: '7px 11px',
        background: 'var(--chrome-surface)', color: 'var(--chrome-hover-text)',
        border: `1px solid ${selected ? data.color : 'var(--chrome-border)'}`,
        borderLeft: `${bar}px solid ${data.color}`, borderRadius: 'var(--radius-2)',
        boxShadow: selected
          ? `0 0 0 2px ${data.color}, var(--shadow-3)`
          : ring ? `0 0 0 1px color-mix(in srgb, ${data.color} 45%, transparent), var(--shadow-1)` : 'var(--shadow-1)',
        fontFamily: 'var(--font-ui)', fontSize: tier >= 2 ? '0.82rem' : '0.78rem', fontWeight: weight,
        lineHeight: 1.2, cursor: 'pointer',
        transition: 'border-color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)',
      }}
      title={data.chapterTitle ? `Defined in Ch.${data.chapterNumber ?? ''} ${data.chapterTitle}${dep ? ` · ${dep} concept${dep > 1 ? 's' : ''} build on this` : ''}` : undefined}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} isConnectable={false} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: showLabel ? 1 : 0, transition: 'opacity 120ms ease' }}>{data.label}</span>
      {dep >= 2 && showLabel && (
        <span
          aria-hidden
          style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 2,
            fontFamily: 'var(--font-code)', fontFeatureSettings: '"tnum" 1', fontSize: '0.6rem', fontWeight: 600,
            color: data.color, opacity: 0.9,
          }}
        >
          <GitFork size={9} strokeWidth={2.4} style={{ transform: 'rotate(180deg)' }} />{dep}
        </span>
      )}
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
        width: data.width, padding: '12px 16px',
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

const useViewportWidth = () => {
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1440))
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const on = () => { clearTimeout(t); t = setTimeout(() => setW(window.innerWidth), 150) }
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('resize', on); clearTimeout(t) }
  }, [])
  return w
}

export default function KnowledgeGraph() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const [outline, setOutline] = useState<OutlineData | null>(null)
  const [loading, setLoading] = useState(true)
  const [rf, setRf] = useState<ReactFlowInstance<Node, Edge> | null>(null)

  const vw = useViewportWidth()
  const isMobile = vw < 760
  const layout = useMemo(() => pickLayout(vw), [vw])

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
    return buildConceptGraph(outline, order, layout)
  }, [outline, layout])

  // id -> concept data, for the panel
  const conceptById = useMemo(() => {
    const m = new Map<string, ConceptNodeData>()
    for (const n of nodes) if (n.type === 'concept') m.set(n.id, n.data as ConceptNodeData)
    return m
  }, [nodes])

  // prerequisite adjacency (concept edges only; spine edges excluded)
  const adj = useMemo(() => {
    const incoming = new Map<string, string[]>() // prerequisites of X
    const outgoing = new Map<string, string[]>() // what X unlocks
    for (const e of edges) {
      if ((e.data as { spine?: boolean })?.spine) continue
      if (!incoming.has(e.target)) incoming.set(e.target, [])
      incoming.get(e.target)!.push(e.source)
      if (!outgoing.has(e.source)) outgoing.set(e.source, [])
      outgoing.get(e.source)!.push(e.target)
    }
    return { incoming, outgoing }
  }, [edges])

  const [hovered, setHovered] = useState<string | null>(null)
  const [focused, setFocused] = useState<string | null>(null)
  const active = focused ?? hovered

  // The lens: a concept's full prerequisite ancestry (what you must know first)
  // plus its direct dependents (what it unlocks).
  const related = useMemo(() => {
    if (!active || tier !== 'dag') return null
    const set = new Set<string>([active])
    const stack = [active]
    while (stack.length) {
      const n = stack.pop()!
      for (const p of adj.incoming.get(n) || []) if (!set.has(p)) { set.add(p); stack.push(p) }
    }
    for (const d of adj.outgoing.get(active) || []) set.add(d)
    return set
  }, [active, adj, tier])

  // recenter on focus
  useEffect(() => {
    if (!focused || !rf) return
    const n = nodes.find((x) => x.id === focused)
    if (!n) return
    const w = (n.data as { width?: number }).width ?? 184
    rf.setCenter(n.position.x + w / 2, n.position.y + 22, { zoom: Math.max(rf.getZoom(), isMobile ? 0.7 : 0.85), duration: 520 })
  }, [focused, rf, nodes, isMobile])

  const openChapter = useCallback((chapterId: string) => { if (bookId && chapterId) navigate(`/book/${bookId}/${chapterId}`) }, [bookId, navigate])

  // React Flow 12 + React 19 don't deliver per-node onClick/onMouseEnter to our
  // handlers (verified: the synthetic events never fire). So we DELEGATE from the
  // container — every RF node carries a data-id and a `react-flow__node-<type>`
  // class, which is all we need to resolve the click.
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onClick = (e: MouseEvent) => {
      const nodeEl = (e.target as HTMLElement).closest('.react-flow__node') as HTMLElement | null
      const id = nodeEl?.getAttribute('data-id')
      if (!nodeEl || !id) return
      if (nodeEl.classList.contains('react-flow__node-concept')) setFocused(id)
      else if (nodeEl.classList.contains('react-flow__node-chapter')) openChapter(id.replace(/^ch-/, ''))
    }
    const onOver = (e: MouseEvent) => {
      const nodeEl = (e.target as HTMLElement).closest('.react-flow__node-concept') as HTMLElement | null
      setHovered(nodeEl?.getAttribute('data-id') ?? null)
    }
    el.addEventListener('click', onClick)
    el.addEventListener('mouseover', onOver)
    return () => { el.removeEventListener('click', onClick); el.removeEventListener('mouseover', onOver) }
    // re-bind once `loading` clears — on the first (loading) render the container
    // div isn't mounted yet, so the listener would otherwise never attach.
  }, [openChapter, loading])
  const clearFocus = useCallback(() => { setFocused(null); setHovered(null) }, [])

  // Escape closes the lens (pane-click can't: React Flow bubbles the node click to
  // the pane, which would clear focus the instant you set it).
  useEffect(() => {
    if (!focused) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') clearFocus() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focused, clearFocus])

  const displayNodes = useMemo(
    () => nodes.map((n) => ({
      ...n,
      selected: n.id === focused,
      style: { opacity: related && !related.has(n.id) && n.type === 'concept' ? 0.12 : related && n.type === 'chapter' ? 0.5 : 1, transition: 'opacity 180ms ease' },
    })),
    [nodes, related, focused],
  )

  const displayEdges = useMemo(
    () => edges.map((e) => {
      if ((e.data as { spine?: boolean })?.spine) {
        return { ...e, type: 'smoothstep', markerEnd: undefined, style: { stroke: 'var(--chrome-accent)', strokeWidth: 2, opacity: related ? 0.14 : 0.4 } }
      }
      // resting: the dependency web is visible (this is the point of the graph),
      // but quiet enough not to tangle. Focus/hover lights the active lineage.
      if (!related) {
        return { ...e, type: 'smoothstep', markerEnd: undefined, style: { stroke: 'rgba(148,163,184,0.45)', strokeWidth: 1, opacity: 0.16 } }
      }
      const on = related.has(e.source) && related.has(e.target)
      return { ...e, type: 'smoothstep', markerEnd: undefined, style: { stroke: on ? 'var(--chrome-accent)' : 'rgba(148,163,184,0.3)', strokeWidth: on ? 2 : 1, opacity: on ? 0.95 : 0.03 } }
    }),
    [edges, related],
  )

  // top-anchored, width-fit initial viewport — opens "here's chapter one, scroll
  // down through the book," legibly, whether 3 chapters or 102.
  const initialViewport = useMemo(() => {
    if (!nodes.length) return { x: 0, y: 0, zoom: 1 }
    let minX = Infinity, maxX = -Infinity, minY = Infinity
    for (const n of nodes) {
      const w = (n.data as { width?: number }).width ?? (n.type === 'chapter' ? 280 : 184)
      minX = Math.min(minX, n.position.x)
      maxX = Math.max(maxX, n.position.x + w)
      minY = Math.min(minY, n.position.y)
    }
    const graphW = maxX - minX
    const pad = isMobile ? 28 : 140
    const zoom = Math.min(isMobile ? 0.92 : 0.85, Math.max(0.34, (vw - pad) / graphW))
    const x = (vw - graphW * zoom) / 2 - minX * zoom
    const y = (isMobile ? 118 : 150) - minY * zoom
    return { x, y, zoom }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, vw, isMobile])

  const prereqCount = useMemo(() => edges.filter((e) => !(e.data as { spine?: boolean })?.spine).length, [edges])
  const subtitle =
    tier === 'dag' ? `${chapterCount} chapters · ${conceptCount} concepts · ${prereqCount} prerequisite links — tap a concept to trace it`
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

  const focusData = focused ? conceptById.get(focused) : null
  const needs = focused ? (adj.incoming.get(focused) || []) : []
  const unlocks = focused ? (adj.outgoing.get(focused) || []) : []

  return (
    <div ref={containerRef} style={{ width: '100vw', height: '100dvh', background: 'var(--chrome-bg)', position: 'relative', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5,
          padding: isMobile ? 'var(--space-3) var(--space-4) var(--space-6)' : 'var(--space-4) var(--space-6) var(--space-7)',
          background: 'linear-gradient(180deg, var(--chrome-bg) 55%, transparent)', pointerEvents: 'none',
        }}
      >
        <div style={{ pointerEvents: 'auto', maxWidth: 'min(100%, 720px)' }}>
          <Link to={bookId ? `/book/${bookId}` : '/'} style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '0.68rem', color: 'var(--chrome-text)', textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>
            &larr; Back to reader
          </Link>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: isMobile ? '1.5rem' : '2rem', fontWeight: 600, color: 'var(--chrome-hover-text)', margin: '4px 0 0', lineHeight: 1.1 }}>
            Knowledge Map
          </h1>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: isMobile ? '0.66rem' : '0.7rem', color: 'var(--chrome-text)', marginTop: 4, letterSpacing: '0.02em', opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>
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
          onInit={setRf}
          defaultViewport={initialViewport}
          minZoom={0.08}
          maxZoom={2.2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          panOnScroll
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="rgba(148,163,184,0.10)" />
          {!isMobile && <Controls showInteractive={false} position="bottom-left" />}
          {!isMobile && (
            <MiniMap
              pannable zoomable
              nodeColor={(n) => ((n.data as { color?: string })?.color as string) || '#4E6E8E'}
              nodeStrokeColor="transparent"
              maskColor="rgba(10,14,23,0.62)"
              style={{ background: 'var(--chrome-surface)', border: '1px solid var(--chrome-border)', borderRadius: 'var(--radius-2)' }}
            />
          )}
        </ReactFlow>
      )}

      {/* Discoverability hint — only on the real graph, only before first focus */}
      {tier === 'dag' && !focused && (
        <div style={{ position: 'absolute', bottom: isMobile ? 16 : 18, left: '50%', transform: 'translateX(-50%)', zIndex: 6, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 'var(--radius-full)', background: 'var(--chrome-glass, rgba(20,20,26,0.7))', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)', border: '1px solid var(--chrome-border)', fontFamily: 'var(--font-ui)', fontSize: '0.72rem', color: 'var(--chrome-text)', whiteSpace: 'nowrap' }}>
          <GitFork size={12} strokeWidth={2} style={{ transform: 'rotate(180deg)', color: 'var(--chrome-accent)' }} />
          Tap a concept to trace what it needs &amp; unlocks
        </div>
      )}

      {/* Focus lens panel — side rail on desktop, bottom sheet on phones */}
      <AnimatePresence>
        {focusData && (
          <motion.aside
            key="concept-panel"
            initial={isMobile ? { y: '100%' } : { x: 32, opacity: 0 }}
            animate={isMobile ? { y: 0 } : { x: 0, opacity: 1 }}
            exit={isMobile ? { y: '100%' } : { x: 32, opacity: 0 }}
            transition={spring.default}
            style={{
              position: 'absolute', zIndex: 70, // above the facet switcher (z60) so the sheet isn't clipped
              ...(isMobile
                ? { left: 0, right: 0, bottom: 0, maxHeight: '62vh', borderRadius: '18px 18px 0 0', borderTop: '1px solid var(--chrome-border)' }
                : { top: 92, right: 18, width: 330, maxHeight: 'calc(100dvh - 130px)', borderRadius: 'var(--radius-3)', border: '1px solid var(--chrome-border)' }),
              background: 'var(--chrome-surface)', boxShadow: 'var(--shadow-4)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            {isMobile && <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--chrome-border)', margin: '8px auto 2px' }} />}
            <div style={{ padding: isMobile ? '8px 18px 12px' : '16px 18px 12px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <span style={{ width: 4, alignSelf: 'stretch', minHeight: 32, borderRadius: 2, background: focusData.color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', fontWeight: 600, color: 'var(--chrome-hover-text)', lineHeight: 1.2 }}>{focusData.label}</div>
                <Link
                  to={`/book/${bookId}/${focusData.chapterId}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4, fontFamily: 'var(--font-ui)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--chrome-accent)', textDecoration: 'none' }}
                >
                  <BookOpen size={12} strokeWidth={2} /> Read in Ch.{focusData.chapterNumber} · {focusData.chapterTitle}
                </Link>
                <div style={{ display: 'flex', gap: 14, marginTop: 8, fontFamily: 'var(--font-ui)', fontSize: '0.66rem', color: 'var(--chrome-text)', opacity: 0.75 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Layers size={11} strokeWidth={2} />depth {focusData.depth}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><GitFork size={11} strokeWidth={2} style={{ transform: 'rotate(180deg)' }} />{focusData.dependents} build on it</span>
                </div>
              </div>
              <button onClick={clearFocus} aria-label="Close" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, border: 'none', borderRadius: 'var(--radius-full)', background: 'transparent', color: 'var(--chrome-text)', cursor: 'pointer' }}>
                <X size={16} strokeWidth={2} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', padding: isMobile ? '0 18px calc(22px + env(safe-area-inset-bottom, 0px))' : '0 18px 18px' }}>
              <ChipGroup
                icon={<CornerDownRight size={12} strokeWidth={2.4} />}
                label="Needs first"
                empty="Foundational — needs nothing before it."
                slugs={needs} conceptById={conceptById} onPick={setFocused}
              />
              <ChipGroup
                icon={<ArrowRight size={12} strokeWidth={2.4} />}
                label="Unlocks"
                empty="A leaf — nothing here builds on it yet."
                slugs={unlocks} conceptById={conceptById} onPick={setFocused}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  )
}

function ChipGroup({ icon, label, empty, slugs, conceptById, onPick }: {
  icon: React.ReactNode
  label: string
  empty: string
  slugs: string[]
  conceptById: Map<string, ConceptNodeData>
  onPick: (id: string) => void
}) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontFamily: 'var(--font-ui)', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--chrome-text)' }}>
        <span style={{ color: 'var(--chrome-accent)' }}>{icon}</span>{label}
        <span style={{ fontFamily: 'var(--font-code)', opacity: 0.6, fontWeight: 600 }}>{slugs.length}</span>
      </div>
      {slugs.length === 0 ? (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--chrome-text)', opacity: 0.6 }}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {slugs.map((s) => {
            const d = conceptById.get(s)
            return (
              <button
                key={s}
                onClick={() => onPick(s)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', minHeight: 30,
                  fontFamily: 'var(--font-ui)', fontSize: '0.76rem', fontWeight: 500, color: 'var(--chrome-hover-text)',
                  background: 'var(--chrome-bg)', border: '1px solid var(--chrome-border)',
                  borderLeft: `3px solid ${d?.color ?? 'var(--chrome-accent)'}`, borderRadius: 'var(--radius-1)', cursor: 'pointer',
                }}
              >
                {d?.label ?? s}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
