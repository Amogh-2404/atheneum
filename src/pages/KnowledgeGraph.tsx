import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useConcepts } from '@/hooks/useConcepts'
import { useBook } from '@/hooks/useBook'
import type { ConceptIndex } from '@/lib/concept-extractor'
import { SkeletonGraph, ShimmerStyle } from '@/components/shared/Skeleton'

// ─── Physics types ────────────────────────────────────────────────

interface Node {
  id: string
  label: string
  chapterId: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  connections: number
}

interface Edge {
  source: string
  target: string
  type: 'same-chapter' | 'reference'
}

// ─── Color palette for chapters ──────────────────────────────────

const CHAPTER_COLORS = [
  '#52FEFE', // cyan (accent)
  '#f472b6', // pink
  '#a78bfa', // purple
  '#34d399', // green
  '#fbbf24', // amber
  '#fb923c', // orange
  '#60a5fa', // blue
  '#e879f9', // fuchsia
  '#4ade80', // emerald
  '#f87171', // red
]

function getChapterColor(chapterId: string, chapterIds: string[]): string {
  const idx = chapterIds.indexOf(chapterId)
  return CHAPTER_COLORS[idx % CHAPTER_COLORS.length]
}

// ─── Build graph data ─────────────────────────────────────────────

function buildGraph(
  conceptIndex: ConceptIndex,
  _chapterIds: string[]
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const nodeIds = new Set<string>()

  // Create nodes from concepts
  conceptIndex.concepts.forEach((concept, key) => {
    nodeIds.add(key)
    nodes.push({
      id: key,
      label: concept.name,
      chapterId: concept.chapterId,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 0,
      connections: 0,
    })
  })

  if (nodes.length === 0) return { nodes, edges }

  // Edges: same-chapter connections — CHAIN only (A→B→C), not full mesh (A↔B, A↔C, B↔C)
  // Full mesh creates O(n²) edges per chapter, collapsing the graph into a ball
  const chapterGroups = new Map<string, string[]>()
  for (const node of nodes) {
    if (!chapterGroups.has(node.chapterId)) chapterGroups.set(node.chapterId, [])
    chapterGroups.get(node.chapterId)!.push(node.id)
  }
  chapterGroups.forEach((group) => {
    for (let i = 0; i < group.length - 1; i++) {
      edges.push({ source: group[i], target: group[i + 1], type: 'same-chapter' })
    }
  })

  // Edges: cross-references
  conceptIndex.references.forEach((chapterRefs, conceptName) => {
    if (!nodeIds.has(conceptName)) return
    // Find concepts defined in chapters that reference this concept
    for (const refChapterId of chapterRefs) {
      const conceptsInChapter = nodes.filter(
        (n) => n.chapterId === refChapterId && n.id !== conceptName
      )
      for (const target of conceptsInChapter) {
        // Avoid duplicate edges
        const exists = edges.some(
          (e) =>
            (e.source === conceptName && e.target === target.id) ||
            (e.source === target.id && e.target === conceptName)
        )
        if (!exists) {
          edges.push({ source: conceptName, target: target.id, type: 'reference' })
        }
      }
    }
  })

  // Count connections per node
  for (const edge of edges) {
    const s = nodes.find((n) => n.id === edge.source)
    const t = nodes.find((n) => n.id === edge.target)
    if (s) s.connections++
    if (t) t.connections++
  }

  // Set radius: base 30, scale with connections, cap at 55
  const maxConnections = Math.max(1, ...nodes.map(n => n.connections))
  for (const node of nodes) {
    const normalized = node.connections / maxConnections
    node.radius = Math.max(30, Math.min(55, 28 + normalized * 27))
  }

  return { nodes, edges }
}

// ─── Force simulation ─────────────────────────────────────────────

function initializePositions(nodes: Node[], width: number, height: number) {
  // Group by chapter, lay out chapter clusters in a large circle,
  // then scatter nodes within each cluster
  const cx = width / 2
  const cy = height / 2

  const chapterGroups = new Map<string, Node[]>()
  for (const node of nodes) {
    if (!chapterGroups.has(node.chapterId)) chapterGroups.set(node.chapterId, [])
    chapterGroups.get(node.chapterId)!.push(node)
  }

  const chapters = Array.from(chapterGroups.keys())
  const outerRadius = Math.min(width, height) * 0.35

  chapters.forEach((chId, ci) => {
    const chAngle = (2 * Math.PI * ci) / chapters.length
    const clusterCx = cx + outerRadius * Math.cos(chAngle)
    const clusterCy = cy + outerRadius * Math.sin(chAngle)
    const group = chapterGroups.get(chId)!
    const innerRadius = 30 + group.length * 12

    group.forEach((node, ni) => {
      const nodeAngle = (2 * Math.PI * ni) / group.length
      node.x = clusterCx + innerRadius * Math.cos(nodeAngle) + (Math.random() - 0.5) * 20
      node.y = clusterCy + innerRadius * Math.sin(nodeAngle) + (Math.random() - 0.5) * 20
      node.vx = 0
      node.vy = 0
    })
  })
}

function simulate(
  nodes: Node[],
  edges: Edge[],
  width: number,
  height: number
) {
  const damping = 0.82
  const repulsion = 5000
  const springLength = 100
  const springStrength = 0.005
  const centerPull = 0.001

  // Repulsion between all nodes (Coulomb)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x
      const dy = nodes[j].y - nodes[i].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = repulsion / (dist * dist)
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      nodes[i].vx -= fx
      nodes[i].vy -= fy
      nodes[j].vx += fx
      nodes[j].vy += fy
    }
  }

  // Spring force on edges
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  for (const edge of edges) {
    const s = nodeMap.get(edge.source)
    const t = nodeMap.get(edge.target)
    if (!s || !t) continue
    const dx = t.x - s.x
    const dy = t.y - s.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const displacement = dist - springLength
    const force = displacement * springStrength
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force
    s.vx += fx
    s.vy += fy
    t.vx -= fx
    t.vy -= fy
  }

  // Pull toward center
  const cx = width / 2
  const cy = height / 2
  for (const node of nodes) {
    node.vx += (cx - node.x) * centerPull
    node.vy += (cy - node.y) * centerPull
  }

  // Apply velocity + damping
  for (const node of nodes) {
    node.vx *= damping
    node.vy *= damping
    node.x += node.vx
    node.y += node.vy
    // Clamp to bounds
    const pad = node.radius + 10
    node.x = Math.max(pad, Math.min(width - pad, node.x))
    node.y = Math.max(pad, Math.min(height - pad, node.y))
  }
}

// ─── Component ────────────────────────────────────────────────────

export default function KnowledgeGraph() {
  const { bookId } = useParams()
  const navigate = useNavigate()
  const { book } = useBook(bookId)
  const { conceptIndex, loading } = useConcepts(bookId)
  const svgRef = useRef<SVGSVGElement>(null)
  const animRef = useRef<number>(0)
  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])
  const [, forceRender] = useState(0)
  const [hovered, setHovered] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null)

  // Measure container
  useEffect(() => {
    function onResize() {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Build graph when concept index is ready
  useEffect(() => {
    if (!conceptIndex || !book) return
    const chapterIds = book.chapters.map((c) => c.id)
    const { nodes, edges } = buildGraph(conceptIndex, chapterIds)
    initializePositions(nodes, dimensions.width, dimensions.height)
    nodesRef.current = nodes
    edgesRef.current = edges
    forceRender((n) => n + 1)
  }, [conceptIndex, book, dimensions.width, dimensions.height])

  // Animation loop
  useEffect(() => {
    let frame = 0
    const maxFrames = 500 // More frames for dense graphs to settle

    function tick() {
      if (frame >= maxFrames) return
      simulate(
        nodesRef.current,
        edgesRef.current,
        dimensions.width,
        dimensions.height
      )
      forceRender((n) => n + 1)
      frame++
      animRef.current = requestAnimationFrame(tick)
    }

    if (nodesRef.current.length > 0) {
      animRef.current = requestAnimationFrame(tick)
    }

    return () => cancelAnimationFrame(animRef.current)
  }, [conceptIndex, dimensions])

  // Drag handlers
  const onMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault()
    const node = nodesRef.current.find((n) => n.id === nodeId)
    if (!node) return
    dragRef.current = {
      nodeId,
      offsetX: e.clientX - node.x,
      offsetY: e.clientY - node.y,
    }
  }, [])

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current) return
      const node = nodesRef.current.find((n) => n.id === dragRef.current!.nodeId)
      if (!node) return
      node.x = e.clientX - dragRef.current.offsetX
      node.y = e.clientY - dragRef.current.offsetY
      node.vx = 0
      node.vy = 0
      forceRender((n) => n + 1)
    }
    function onMouseUp() {
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const goToDefinition = useCallback(
    (nodeId: string) => {
      const concept = conceptIndex?.concepts.get(nodeId)
      if (!concept) return
      navigate(`/book/${concept.bookId}/${concept.chapterId}`)
    },
    [conceptIndex, navigate]
  )

  const chapterIds = book?.chapters.map((c) => c.id) || []
  const nodes = nodesRef.current
  const edges = edgesRef.current
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--chrome-bg)' }}>
        <ShimmerStyle />
        <SkeletonGraph />
      </div>
    )
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'var(--chrome-bg)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          padding: '1rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(180deg, var(--chrome-bg) 60%, transparent)',
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, pointerEvents: 'auto' }}>
          <Link
            to={bookId ? `/book/${bookId}` : '/'}
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.85rem',
              color: 'var(--chrome-text)',
              textDecoration: 'none',
              transition: 'color 200ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--chrome-hover-text, #f1f5f9)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--chrome-text)' }}
          >
            &larr; Back to reader
          </Link>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.6rem',
              fontWeight: 700,
              color: 'var(--chrome-accent)',
              margin: 0,
            }}
          >
            Knowledge Map
          </h1>
        </div>

        <div
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '0.75rem',
            color: 'var(--chrome-text)',
            letterSpacing: '0.04em',
            pointerEvents: 'auto',
          }}
        >
          {nodes.length} concepts &middot; {edges.length} connections
        </div>
      </motion.div>

      {/* Legend */}
      {book && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          style={{
            position: 'absolute',
            bottom: 24,
            left: 24,
            zIndex: 10,
            background: 'rgba(10, 14, 23, 0.85)',
            border: '1px solid var(--chrome-border)',
            borderRadius: 8,
            padding: '12px 16px',
            maxWidth: 240,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.65rem',
              color: 'var(--chrome-text)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 8,
            }}
          >
            Chapters
          </div>
          {book.chapters.map((ch) => (
            <div
              key={ch.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '2px 0',
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: getChapterColor(ch.id, chapterIds),
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.72rem',
                  color: 'var(--chrome-text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {ch.number}. {ch.title}
              </span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Empty state */}
      {nodes.length === 0 && !loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.5rem',
              color: 'var(--chrome-text)',
            }}
          >
            No concepts defined yet
          </div>
          <div
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.85rem',
              color: 'var(--chrome-text)',
              opacity: 0.6,
            }}
          >
            Add definition callouts to your chapters to populate the knowledge graph.
          </div>
        </div>
      )}

      {/* SVG Graph */}
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ display: 'block', cursor: dragRef.current ? 'grabbing' : 'default' }}
      >
        {/* Edges */}
        {edges.map((edge, i) => {
          const s = nodeMap.get(edge.source)
          const t = nodeMap.get(edge.target)
          if (!s || !t) return null
          const isHighlighted =
            hovered === edge.source || hovered === edge.target
          return (
            <line
              key={`edge-${i}`}
              x1={s.x}
              y1={s.y}
              x2={t.x}
              y2={t.y}
              stroke={
                isHighlighted
                  ? 'var(--chrome-accent)'
                  : edge.type === 'reference'
                    ? 'rgba(82, 254, 254, 0.3)'
                    : 'rgba(148, 163, 184, 0.2)'
              }
              strokeWidth={isHighlighted ? 2.5 : 1.2}
              strokeDasharray={edge.type === 'reference' ? '6,3' : 'none'}
              style={{ transition: 'stroke 200ms, stroke-width 200ms' }}
            />
          )
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const color = getChapterColor(node.chapterId, chapterIds)
          const isHovered = hovered === node.id
          return (
            <g
              key={node.id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(node.id)}
              onMouseLeave={() => setHovered(null)}
              onMouseDown={(e) => onMouseDown(e, node.id)}
              onDoubleClick={() => goToDefinition(node.id)}
            >
              {/* Glow */}
              {isHovered && (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.radius + 6}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  opacity={0.3}
                />
              )}

              {/* Node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.radius}
                fill={isHovered ? color : 'var(--chrome-surface)'}
                stroke={color}
                strokeWidth={isHovered ? 2 : 1.5}
                style={{ transition: 'fill 200ms, stroke-width 200ms' }}
              />

              {/* Label */}
              <text
                x={node.x}
                y={node.y}
                textAnchor="middle"
                dominantBaseline="central"
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: Math.min(11, node.radius * 0.4) + 'px',
                  fontWeight: 700,
                  fill: isHovered ? 'var(--chrome-bg)' : color,
                  pointerEvents: 'none',
                  transition: 'fill 200ms',
                  userSelect: 'none',
                }}
              >
                {node.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Hover tooltip */}
      {hovered && (() => {
        const node = nodeMap.get(hovered)
        const concept = conceptIndex?.concepts.get(hovered)
        if (!node || !concept) return null
        const chapter = book?.chapters.find((c) => c.id === concept.chapterId)
        return (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              position: 'absolute',
              left: Math.min(node.x + node.radius + 12, dimensions.width - 280),
              top: Math.max(node.y - 30, 60),
              zIndex: 20,
              background: 'var(--chrome-surface)',
              border: '1px solid var(--chrome-accent)',
              borderRadius: 8,
              padding: '10px 14px',
              maxWidth: 260,
              pointerEvents: 'none',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '1.05rem',
                fontWeight: 700,
                color: getChapterColor(concept.chapterId, chapterIds),
                marginBottom: 4,
              }}
            >
              {concept.name}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.85rem',
                color: '#cbd5e1',
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                marginBottom: 6,
              }}
            >
              {concept.definition}
            </div>
            {chapter && (
              <div
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.65rem',
                  color: 'var(--chrome-text)',
                  letterSpacing: '0.03em',
                }}
              >
                Ch. {chapter.number}: {chapter.title}
              </div>
            )}
            <div
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.6rem',
                color: 'var(--chrome-text)',
                opacity: 0.6,
                marginTop: 4,
              }}
            >
              Double-click to go to definition
            </div>
          </motion.div>
        )
      })()}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
