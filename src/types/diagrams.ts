/* ─── Atheneum Diagram IR ────────────────────────────────────────────────────
   Single source of truth for every diagram in every Atheneum book.

   One IR. Eight engines. Twelve target categories. Three brand styles per book.
   Every diagram routes to exactly one engine, but every engine reads the same
   shared envelope (caption, primary_insight, category, narrative, quality).

   Quality bar: layout solver and pedagogy lint both run at compile time.
   No diagram ships with overlaps, with unlabeled arrows, or without a caption
   that contains a verb. The cookbook (~/.jarvis/docs/diagram_cookbook.md) is
   the binding spec — this file is its machine-checkable form.

   Backward compatibility: existing Excalidraw-only diagrams (diagramFile or
   inlineData with no engine spec) still validate. They are treated as
   engine="sketch" implicitly during lint.
───────────────────────────────────────────────────────────────────────────── */

import { z } from 'zod'

// ─── Cookbook taxonomy ───────────────────────────────────────────────

/** Eight rendering engines — one per cookbook category cluster. */
export const DiagramEngineEnum = z.enum([
  'system',     // ByteByteGo layered architecture (React Flow + dagre)
  'flow',       // Numbered swim-lane API/request flow (custom SVG)
  'er',         // Database schema (DBML → custom SVG, crow's-foot)
  'pipeline',   // L→R ETL stages (custom React)
  'compare',    // Comparison matrix (CSS grid + symbols)
  'algorithm',  // DSA state machine + synced pseudocode
  'sketch',     // Excalidraw hand-drawn (current default)
  'mind',       // Radial mind map (D3)
  'timeline',   // Swim-lane timeline (flexbox)
  'network',    // Concentric topology zones (React Flow + AWS stencils)
  'manim',      // Math/proof animation (Manim Python → MP4)
  'custom-svg', // One-off cinematic hand-authored SVG
])
export type DiagramEngine = z.infer<typeof DiagramEngineEnum>

/** Cookbook category — picks the visual format. Authors don't default to
 *  flowcharts; the cookbook decision table picks the right shape per intent. */
export const DiagramCategoryEnum = z.enum([
  'system-architecture',     // §1
  'api-flow',                // §2
  'database-er',             // §3
  'network-topology',        // §4
  'data-pipeline',           // §5
  'comparison',              // §6
  'cheatsheet',              // §7
  'dsa-algorithm',           // §8
  'math-proof',              // §9
  'sketchnote',              // §10
  'timeline',                // §11
  'mind-map',                // §12
  'process-workflow',        // §13
  'market-microstructure',   // §14
  'interactive-animated',    // §15
])
export type DiagramCategory = z.infer<typeof DiagramCategoryEnum>

/** Brand style — one of three per-book presentations of the same spec.
 *  Reader theme toggle re-renders diagrams in the matching style. */
export const DiagramStyleEnum = z.enum([
  'bytebytego',   // Day — flat 2D, semantic-color tiers, white background
  'manim-dark',   // 3Blue1Brown — dark navy, yellow accents, math-clean
  'sketchnote',   // Hand-drawn — Excalidraw fontFamily=1, sketchiness=2
  'academic',     // Publication — black/grey, serif labels, vector-only
  'hud',          // JARVIS chrome — dark bg, neon accents, monospaced
  'cinematic',    // Hero diagrams — full-bleed, brand-color washes
])
export type DiagramStyle = z.infer<typeof DiagramStyleEnum>

// ─── Animation grammar ───────────────────────────────────────────────

/** A single step in a paced reveal animation. GSAP timeline DSL.
 *  Reader controls: space=advance, ←/→=step, R=replay, S=scrub.
 *  Synced to TTS narration in the audio podcast backend. */
export const AnimationStepSchema = z.object({
  /** Timestamp ("0.8s") or named label ("step1") — the GSAP timeline anchor. */
  at: z.union([z.string(), z.number()]),
  /** Node ids to fade-in at this step. */
  show: z.array(z.string()).optional(),
  /** Node ids to fade-out at this step. */
  hide: z.array(z.string()).optional(),
  /** Edge id to draw with the standard arrow-grow animation. */
  drawArrow: z.string().optional(),
  /** Step caption (≤60 chars per cookbook §15). */
  label: z.string().max(60).optional(),
  /** Default 0.6s reveal; cap at 10s to prevent dead time. */
  duration: z.number().min(0).max(10).default(0.6),
  /** Highlight an existing node (pulse-amber or color-swap). */
  highlight: z.string().optional(),
  /** Drop a step number ("1", "2a", "5b") next to the affected element. */
  stepNumber: z.string().max(4).optional(),
})
export type AnimationStep = z.infer<typeof AnimationStepSchema>

// ─── Engine specs (discriminated by `engine`) ────────────────────────

/** Shared node primitive. Engine-specific specs may extend this. */
const NodeBaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  /** Tier or cluster the node belongs to — informs semantic color. */
  tier: z.string().optional(),
  /** Icon ref — "aws/s3", "gcp/pubsub", "lucide/server", etc. */
  icon: z.string().optional(),
})

/** Shared edge primitive. Every edge is labeled by default per cookbook. */
const EdgeBaseSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  /** Action verb — "queries", "publishes", "authenticates" — never "calls". */
  label: z.string().min(1).max(60),
  /** Critical-path edges render thicker (3px vs 2px). */
  emphasis: z.enum(['normal', 'critical']).default('normal'),
  /** Step number overlay (cookbook §1 + §2 mandate). */
  stepNumber: z.string().max(4).optional(),
})

/** §1 System Architecture (ByteByteGo). Layered horizontal tiers,
 *  semantic color per tier, step-number overlays on arrows. */
export const SystemSpecSchema = z.object({
  engine: z.literal('system'),
  /** Tier definitions — top-to-bottom. Cookbook fixes 4-5 tiers max. */
  tiers: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1).max(40),
    /** Cookbook-mandated semantic color per tier role. */
    role: z.enum(['client', 'service', 'storage', 'external', 'async']),
  })).min(2).max(5),
  nodes: z.array(NodeBaseSchema.extend({
    /** Which tier this node belongs to (must match a tier id). */
    tier: z.string().min(1),
  })).min(1).max(20),
  edges: z.array(EdgeBaseSchema).default([]),
})

/** §2 API Flow / Request Lifecycle. Numbered swim-lane, vertical participants. */
export const FlowSpecSchema = z.object({
  engine: z.literal('flow'),
  participants: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1).max(40),
    color: z.string().optional(), // overrides theme default
  })).min(2).max(7), // cookbook §2: max 7 before splitting
  steps: z.array(z.object({
    n: z.number().int().positive(),
    from: z.string(),
    to: z.string(),
    label: z.string().min(1).max(60),
    /** Alt-flow steps render dotted (cookbook §2). */
    alt: z.boolean().default(false),
    /** Parallel-execution group — fork bracket. */
    parallel: z.string().optional(),
  })).min(1),
})

/** §3 Database / ER. Domain-clustered, crow's-foot cardinality. */
export const ERSpecSchema = z.object({
  engine: z.literal('er'),
  /** DBML source string OR structured entities. */
  dbml: z.string().optional(),
  entities: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1).max(40),
    domain: z.string().min(1), // cluster grouping
    pivot: z.boolean().default(false), // central pivot tables get thick borders
    fields: z.array(z.object({
      name: z.string(),
      type: z.string(),
      pk: z.boolean().default(false),
      fk: z.string().optional(),
    })).default([]),
  })).max(20).optional(), // cookbook §3: 15-20 max per diagram
  relationships: z.array(z.object({
    from: z.string(),
    to: z.string(),
    cardinality: z.enum(['1-1', '1-many', 'many-many']),
  })).default([]),
}).refine(d => d.dbml || (d.entities && d.entities.length > 0), {
  message: 'ER diagram needs either dbml source or entities[]',
})

/** §5 Data Pipeline / ETL. L→R stages, semantic color per stage type. */
export const PipelineSpecSchema = z.object({
  engine: z.literal('pipeline'),
  stages: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1).max(40),
    /** Cookbook §5 semantic stage colors. */
    role: z.enum(['source', 'ingest', 'transform', 'storage', 'serving']),
    parallel: z.string().optional(), // batch vs streaming track marker
  })).min(2),
  /** Optional orchestration band underneath (Airflow, Dagster, etc.). */
  orchestrator: z.string().optional(),
  edges: z.array(EdgeBaseSchema).default([]),
})

/** §6 Comparison / Matrix. */
export const CompareSpecSchema = z.object({
  engine: z.literal('compare'),
  rows: z.array(z.string().min(1)).min(2).max(20),
  cols: z.array(z.string().min(1)).min(2).max(8),
  cells: z.array(z.object({
    row: z.string(),
    col: z.string(),
    /** Semantic mark — ✓/✗/⚠️/—/value-string. */
    mark: z.union([z.enum(['yes', 'no', 'partial', 'na']), z.string()]),
    note: z.string().max(40).optional(),
  })),
})

/** §8 DSA / Algorithm. State model + synced pseudocode pane. */
export const AlgorithmSpecSchema = z.object({
  engine: z.literal('algorithm'),
  states: z.array(z.object({
    id: z.string(),
    label: z.string().max(40),
    /** Variable trace overlay at this state. */
    vars: z.record(z.string(), z.string()).optional(),
  })).min(2),
  transitions: z.array(z.object({
    from: z.string(),
    to: z.string(),
    label: z.string().max(40),
    /** Pseudocode line(s) executing during this transition. */
    pseudocodeLines: z.array(z.number().int().nonnegative()).optional(),
  })).default([]),
  /** Pseudocode shown beside the state machine. Each line synced via line index. */
  pseudocode: z.string().optional(),
})

/** §10 Sketchnote / hand-drawn (current Excalidraw default). */
export const SketchSpecSchema = z.object({
  engine: z.literal('sketch'),
  /** Excalidraw scene JSON — passed straight to the lazy-loaded editor. */
  excalidraw: z.unknown(),
})

/** §12 Mind Map. Radial tree, max 3 levels. */
export const MindSpecSchema = z.object({
  engine: z.literal('mind'),
  root: z.object({
    id: z.string(),
    label: z.string().max(40),
  }),
  children: z.array(z.object({
    id: z.string(),
    parent: z.string(),
    label: z.string().max(40),
    /** Cookbook §12: max 3 levels deep. Validated by a lint pass. */
    depth: z.number().int().min(1).max(3),
  })).default([]),
})

/** §11 Timeline. Horizontal swim-lanes per actor or theme. */
export const TimelineSpecSchema = z.object({
  engine: z.literal('timeline'),
  lanes: z.array(z.object({
    id: z.string(),
    label: z.string().max(40),
  })).min(1),
  events: z.array(z.object({
    id: z.string(),
    lane: z.string(),
    at: z.string(), // "Q1 2026", "2026-05-06", "Day 3", etc.
    label: z.string().max(80),
    duration: z.string().optional(), // "3 weeks", "2026-05-06 → 2026-05-15"
  })),
})

/** §4 Network Topology. Concentric zones, AWS/GCP stencils. */
export const NetworkSpecSchema = z.object({
  engine: z.literal('network'),
  zones: z.array(z.object({
    id: z.string(),
    label: z.string().max(40),
    /** Cookbook §4 zone colors. */
    role: z.enum(['internet', 'dmz', 'private', 'data']),
  })).min(2),
  nodes: z.array(NodeBaseSchema.extend({
    zone: z.string(),
  })),
  edges: z.array(EdgeBaseSchema.extend({
    /** Always required for network diagrams — protocol+port. */
    label: z.string().min(1).max(40),
  })).default([]),
})

/** §9 / §14 Manim animation — math, microstructure, payoff diagrams. */
export const ManimSpecSchema = z.object({
  engine: z.literal('manim'),
  /** Manim Python source — built to MP4 at compile time. */
  manimSource: z.string().min(1),
  /** Pre-built MP4 path relative to book/diagrams/ — set by the build. */
  mp4: z.string().optional(),
  /** PNG fallback path for print + low-bandwidth. */
  png: z.string().optional(),
})

/** Last resort: hand-authored SVG, brand-token-constrained. */
export const CustomSvgSpecSchema = z.object({
  engine: z.literal('custom-svg'),
  svg: z.string().min(1),
  /** Concept ids the SVG illustrates, for cross-reference + concept graph. */
  illustrates: z.array(z.string()).default([]),
})

/** Full discriminated union of all 12 engine specs. */
export const DiagramSpecSchema = z.discriminatedUnion('engine', [
  SystemSpecSchema,
  FlowSpecSchema,
  ERSpecSchema,
  PipelineSpecSchema,
  CompareSpecSchema,
  AlgorithmSpecSchema,
  SketchSpecSchema,
  MindSpecSchema,
  TimelineSpecSchema,
  NetworkSpecSchema,
  ManimSpecSchema,
  CustomSvgSpecSchema,
])
export type DiagramSpec = z.infer<typeof DiagramSpecSchema>

// ─── Quality metadata (recorded by the lint + layout passes) ────────

export const LintIssueSchema = z.object({
  severity: z.enum(['error', 'warn', 'info']),
  code: z.string(), // e.g. "DIAG_NO_CAPTION", "DIAG_TOO_MANY_NODES"
  msg: z.string(),
  hint: z.string().optional(),
})
export type LintIssue = z.infer<typeof LintIssueSchema>

export const DiagramQualitySchema = z.object({
  /** Did the LayoutSolver find a valid layout (zero overlaps, zero crossings)? */
  layoutSolved: z.boolean().optional(),
  layoutOverlaps: z.number().int().nonnegative().optional(),
  layoutCrossings: z.number().int().nonnegative().optional(),
  /** 0-100 pedagogy score from the lint pass. <80 ⇒ flagged for refactor. */
  pedagogyScore: z.number().min(0).max(100).optional(),
  issues: z.array(LintIssueSchema).default([]),
  lastAuditedAt: z.string().datetime().optional(),
})
export type DiagramQuality = z.infer<typeof DiagramQualitySchema>

// ─── The DiagramBlock envelope ──────────────────────────────────────

/**
 * The single shared envelope every diagram block uses, regardless of engine.
 *
 * Backward compatibility:
 *   - Existing diagrams in content/ ship with just `diagramFile` or `inlineData`
 *     (legacy Excalidraw path). They still validate.
 *   - New typed diagrams must declare `spec` (which carries `engine`) and
 *     `category`. The lint pass treats legacy diagrams as engine='sketch'.
 */
export const DiagramBlockSchema = z.object({
  // ─── Block envelope ──
  id: z.string().min(1),
  type: z.literal('diagram'),
  status: z.enum(['draft', 'published']).optional(),
  metadata: z.object({
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    insertedAfter: z.string().optional(),
    movedFrom: z.string().optional(),
    origin: z.enum(['original', 'ai-manual', 'ai-improve-loop', 'human-approved']).optional(),
    sourceSignal: z.string().optional(),
    revisionOf: z.string().optional(),
  }).optional(),

  // ─── Pedagogy envelope (cookbook universal rules) ──
  /** Schema accepts string OR a RichText-like array OR null/empty (legacy);
   *  lint pass normalizes and enforces cookbook ≤80 chars + verb-presence. */
  caption: z.union([
    z.string(),
    z.array(z.unknown()),  // legacy RichText form
    z.null(),
  ]).optional(),
  /** "One diagram = one insight" — declared up front, surfaced before render.
   *  Schema permissive; lint enforces ≤120 char ceiling. */
  primaryInsight: z.string().optional(),
  /** Picks the visual format from the cookbook decision table. */
  category: DiagramCategoryEnum.optional(),
  /** Theme-style overlay (Day/Night/Sepia per book). */
  style: DiagramStyleEnum.optional(),
  /** Layout aspect for hero/full-bleed framing. */
  aspect: z.enum(['16:9', '4:3', '1:1', 'golden', 'custom']).default('16:9'),
  /** Concepts this diagram illustrates — wires into outline.json conceptIndex. */
  sourceConcepts: z.array(z.string()).default([]),

  // ─── Layout / sizing ──
  width: z.enum(['narrow', 'medium', 'full', 'wide']).optional(),
  /** Print-target export format — TikZ for math, vector PDF for system, raster fallback. */
  printExport: z.enum(['tikz', 'pdf-vector', 'png-600dpi']).default('png-600dpi'),

  // ─── Content (one of three shapes) ──
  /** New typed spec — discriminated by engine. */
  spec: DiagramSpecSchema.optional(),
  /** Legacy: external Excalidraw scene JSON file (relative to book/diagrams/). */
  diagramFile: z.string().optional(),
  /** Legacy: inline Excalidraw scene JSON. */
  inlineData: z.unknown().optional(),

  // ─── Animation reveal (optional) ──
  narrative: z.array(AnimationStepSchema).min(0).max(9).optional(),

  // ─── Quality (filled in by lint + layout solver) ──
  quality: DiagramQualitySchema.optional(),
}).refine(
  d => d.spec !== undefined || d.diagramFile !== undefined || d.inlineData !== undefined,
  { message: 'DiagramBlock needs one of: spec, diagramFile, or inlineData' },
)
export type DiagramBlock = z.infer<typeof DiagramBlockSchema>

// ─── Helpers used by lint + layout passes ───────────────────────────

/** Whether a diagram is "typed" (uses the new IR) vs. legacy Excalidraw-only. */
export function isTypedDiagram(d: DiagramBlock): boolean {
  return d.spec !== undefined
}

/** Effective engine for a diagram — explicit if typed, else "sketch". */
export function effectiveEngine(d: DiagramBlock): DiagramEngine {
  return d.spec?.engine ?? 'sketch'
}

/** Effective category — explicit if declared, else inferred from engine. */
export function effectiveCategory(d: DiagramBlock): DiagramCategory {
  if (d.category) return d.category
  // Inference table — engine → most-likely category for legacy diagrams.
  const inferred: Record<DiagramEngine, DiagramCategory> = {
    system: 'system-architecture',
    flow: 'api-flow',
    er: 'database-er',
    pipeline: 'data-pipeline',
    compare: 'comparison',
    algorithm: 'dsa-algorithm',
    sketch: 'sketchnote',
    mind: 'mind-map',
    timeline: 'timeline',
    network: 'network-topology',
    manim: 'math-proof',
    'custom-svg': 'sketchnote',
  }
  return inferred[effectiveEngine(d)]
}
