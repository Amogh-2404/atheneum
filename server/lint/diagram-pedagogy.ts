/* ─── Diagram Pedagogy Lint ──────────────────────────────────────────────────
   Machine-checkable form of the diagram cookbook
   (~/.jarvis/docs/diagram_cookbook.md).

   Inputs:  one DiagramBlock from the IR
   Outputs: LintIssue[] (severity: error | warn | info)

   Hard rules (severity=error) fail the build. Soft rules (warn) drop the
   pedagogy score but don't block. Info entries are observations the studio
   surfaces beside the diagram while authoring.

   Cookbook bindings:
     - §universal "caption with verb"       → DIAG_NO_CAPTION, DIAG_CAPTION_NO_VERB
     - §universal "max 5 colors"            → DIAG_TOO_MANY_COLORS
     - §universal "label inline"            → DIAG_UNLABELED_EDGES
     - §universal "concrete before abstract"→ DIAG_ABSTRACT_FIRST (info-only)
     - §universal "one diagram one insight" → DIAG_NO_INSIGHT
     - §universal "min 40px spacing"        → checked by LayoutSolver, not here
     - Miller's law (9±2 nodes)             → DIAG_TOO_MANY_NODES
     - §1 ByteByteGo "no diagonal arrows"   → DIAG_DIAGONAL_ARROW (LayoutSolver)
     - §1 "thick labeled arrows"            → DIAG_UNLABELED_EDGES
     - §2 "max 7 participants"              → enforced in zod schema
     - §3 "max 15-20 entities"              → enforced in zod schema
     - §12 "max 3 levels"                   → DIAG_MIND_TOO_DEEP
     - §15 "narrative 3-9 steps, ≤6 words"  → DIAG_ANIM_TOO_SHORT/LONG/WORDY
───────────────────────────────────────────────────────────────────────────── */

import type {
  DiagramBlock,
  LintIssue,
  DiagramSpec,
  DiagramCategory,
} from '../../src/types/diagrams.ts'
import {
  isTypedDiagram,
  effectiveEngine,
  effectiveCategory,
} from '../../src/types/diagrams.ts'

// ─── Universal cookbook constants ───────────────────────────────────

const MAX_COLORS = 5
const MAX_NODES_DEFAULT = 11   // Miller's law 9±2
const MAX_NODES_COMPARE = 20   // §6 explicit override
const MAX_NODES_MIND = 30      // §12 with depth-3 cap
const MAX_NARRATIVE_STEPS = 9  // §15
const MIN_NARRATIVE_STEPS = 3  // §15
const MAX_STEP_WORDS = 6       // §15
const CAPTION_MAX = 80
const PRIMARY_INSIGHT_MAX = 120

// ─── Verb detection (cookbook §universal) ───────────────────────────

/** Crude but effective verb-ness heuristic: looks for an English verb
 *  inflection in the caption. Cookbook says captions must contain a verb. */
const VERB_RE = /\b(?:[a-z]{3,}(?:s|es|ed|ing)|is|are|was|were|do|does|did|has|have|had|run|runs|ran|build|builds|built|show|shows|writes?|reads?|sends?|fetches?|stores?|computes?)\b/i

/** Caption may arrive as a string, a RichText array of segments, or null
 *  (legacy v2 converter output). Normalize to a single plain string for
 *  length + verb checks. Empty result ⇒ treated as missing. */
function normalizeCaption(c: unknown): string {
  if (typeof c === 'string') return c
  if (Array.isArray(c)) {
    return c
      .map(seg => {
        if (typeof seg === 'string') return seg
        if (seg && typeof seg === 'object' && 'text' in seg && typeof (seg as { text: unknown }).text === 'string') {
          return (seg as { text: string }).text
        }
        return ''
      })
      .join('')
      .trim()
  }
  return ''
}

// ─── Engine-spec inspection helpers ─────────────────────────────────

function nodeCount(spec: DiagramSpec | undefined): number {
  if (!spec) return 0
  switch (spec.engine) {
    case 'system':    return spec.nodes.length
    case 'flow':      return spec.participants.length
    case 'er':        return spec.entities?.length ?? 0
    case 'pipeline':  return spec.stages.length
    case 'compare':   return spec.rows.length * spec.cols.length
    case 'algorithm': return spec.states.length
    case 'mind':      return 1 + spec.children.length
    case 'timeline':  return spec.events.length
    case 'network':   return spec.nodes.length
    case 'sketch':    return 0  // unknowable without parsing Excalidraw scene
    case 'manim':     return 0
    case 'custom-svg':return 0
  }
}

function edgeCount(spec: DiagramSpec | undefined): number {
  if (!spec) return 0
  switch (spec.engine) {
    case 'system':    return spec.edges.length
    case 'flow':      return spec.steps.length
    case 'er':        return spec.relationships.length
    case 'pipeline':  return spec.edges.length
    case 'algorithm': return spec.transitions.length
    case 'network':   return spec.edges.length
    default:          return 0
  }
}

function unlabeledEdgeCount(spec: DiagramSpec | undefined): number {
  if (!spec) return 0
  switch (spec.engine) {
    case 'system':
    case 'pipeline':
    case 'network':
      return spec.edges.filter(e => !e.label || e.label.trim().length === 0).length
    case 'flow':
      return spec.steps.filter(s => !s.label || s.label.trim().length === 0).length
    case 'algorithm':
      return spec.transitions.filter(t => !t.label || t.label.trim().length === 0).length
    default:
      return 0
  }
}

/** Walk the spec for any explicit hex/rgb color refs (raw hex banned —
 *  authors must pull from brand tokens). Returns a count of unique colors. */
function uniqueExplicitColors(spec: DiagramSpec | undefined): number {
  if (!spec) return 0
  const colors = new Set<string>()
  // Only `flow.participants[].color` lets you set a raw color in the IR;
  // everything else routes through brand tokens. Future: scan custom-svg.svg
  // for fill/stroke attrs.
  if (spec.engine === 'flow') {
    for (const p of spec.participants) if (p.color) colors.add(p.color.toLowerCase())
  }
  if (spec.engine === 'custom-svg') {
    const matches = spec.svg.match(/(?:fill|stroke)="(#[0-9a-fA-F]{3,8}|rgb\([^)]+\))"/g) ?? []
    for (const m of matches) colors.add(m.toLowerCase())
  }
  return colors.size
}

/** Mind-map depth check (cookbook §12: max 3 levels). */
function mindDepthExceeded(spec: DiagramSpec | undefined): number {
  if (!spec || spec.engine !== 'mind') return 0
  return spec.children.filter(c => c.depth > 3).length
}

// ─── The lint pass ──────────────────────────────────────────────────

export interface DiagramLintResult {
  issues: LintIssue[]
  /** 0-100 quality score: 100 - 8×errors - 4×warns - 0×info (clamped to 0). */
  score: number
  /** Convenience: number of error-severity issues. Build gates on errors>0. */
  errors: number
}

/**
 * Run the pedagogy lint pass on a single DiagramBlock.
 * Pure function — no I/O. Safe to call from build pipeline, studio UI,
 * audit CLI, or unit tests.
 */
export function lintDiagram(d: DiagramBlock): DiagramLintResult {
  const issues: LintIssue[] = []
  const typed = isTypedDiagram(d)
  const engine = effectiveEngine(d)
  const category = effectiveCategory(d)

  // ─ 1. Caption discipline ─────────────────────────────────────────
  const captionText = normalizeCaption(d.caption)
  if (captionText.length === 0) {
    issues.push({
      severity: typed ? 'error' : 'warn',
      code: 'DIAG_NO_CAPTION',
      msg: 'Diagram has no caption.',
      hint: 'Cookbook §universal: every diagram needs a caption that contains a verb.',
    })
  } else {
    if (captionText.length > CAPTION_MAX) {
      issues.push({
        severity: 'warn',
        code: 'DIAG_LONG_CAPTION',
        msg: `Caption is ${captionText.length} chars (>${CAPTION_MAX}).`,
        hint: 'Trim to a single declarative sentence — cookbook §universal.',
      })
    }
    if (!VERB_RE.test(captionText)) {
      issues.push({
        severity: 'warn',
        code: 'DIAG_CAPTION_NO_VERB',
        msg: 'Caption appears to lack an action verb.',
        hint: 'Cookbook §universal — captions need a verb so the reader knows what is happening.',
      })
    }
  }

  // ─ 2. Primary insight ────────────────────────────────────────────
  if (typed) {
    if (!d.primaryInsight || d.primaryInsight.trim().length < 3) {
      issues.push({
        severity: 'warn',
        code: 'DIAG_NO_INSIGHT',
        msg: 'No primary_insight declared.',
        hint: 'Cookbook §universal: one diagram = one insight. State it explicitly.',
      })
    } else if (d.primaryInsight.length > PRIMARY_INSIGHT_MAX) {
      issues.push({
        severity: 'info',
        code: 'DIAG_INSIGHT_LONG',
        msg: `primary_insight is ${d.primaryInsight.length} chars; consider tightening.`,
      })
    }
  }

  // ─ 3. Category required for typed diagrams ───────────────────────
  if (typed && !d.category) {
    issues.push({
      severity: 'error',
      code: 'DIAG_NO_CATEGORY',
      msg: 'Typed diagram is missing `category` — pick from the 15 cookbook categories.',
      hint: 'See ~/.jarvis/docs/diagram_cookbook.md decision table.',
    })
  }

  // ─ 4. Node count (Miller's law) ──────────────────────────────────
  const nodes = nodeCount(d.spec)
  let nodeLimit = MAX_NODES_DEFAULT
  if (category === 'comparison') nodeLimit = MAX_NODES_COMPARE
  else if (category === 'mind-map') nodeLimit = MAX_NODES_MIND
  if (nodes > nodeLimit) {
    issues.push({
      severity: 'warn',
      code: 'DIAG_TOO_MANY_NODES',
      msg: `${nodes} nodes exceeds Miller's law limit of ${nodeLimit} for ${category}.`,
      hint: 'Split into two diagrams, or zoom out to a higher C4 level.',
    })
  }

  // ─ 5. Color count ────────────────────────────────────────────────
  const colors = uniqueExplicitColors(d.spec)
  if (colors > MAX_COLORS) {
    issues.push({
      severity: 'warn',
      code: 'DIAG_TOO_MANY_COLORS',
      msg: `${colors} explicit colors exceeds cookbook max of ${MAX_COLORS}.`,
      hint: 'Pull colors from brand tokens (semantic, not arbitrary).',
    })
  }

  // ─ 6. Edge labels (cookbook §1, §2, §4) ──────────────────────────
  const totalEdges = edgeCount(d.spec)
  const unlabeled = unlabeledEdgeCount(d.spec)
  if (unlabeled > 0) {
    issues.push({
      severity: 'warn',
      code: 'DIAG_UNLABELED_EDGES',
      msg: `${unlabeled} of ${totalEdges} arrows have no label.`,
      hint: 'Cookbook §1: thick labeled arrows. Use action verbs ("authenticates", "publishes").',
    })
  }

  // ─ 7. Animation discipline (cookbook §15) ────────────────────────
  if (d.narrative !== undefined) {
    if (d.narrative.length < MIN_NARRATIVE_STEPS) {
      issues.push({
        severity: 'warn',
        code: 'DIAG_ANIM_TOO_SHORT',
        msg: `Narrative has ${d.narrative.length} steps (<${MIN_NARRATIVE_STEPS}); not worth animating.`,
      })
    }
    if (d.narrative.length > MAX_NARRATIVE_STEPS) {
      issues.push({
        severity: 'warn',
        code: 'DIAG_ANIM_TOO_LONG',
        msg: `Narrative has ${d.narrative.length} steps (>${MAX_NARRATIVE_STEPS}); split into two diagrams.`,
      })
    }
    for (const step of d.narrative) {
      if (step.label && step.label.split(/\s+/).length > MAX_STEP_WORDS) {
        issues.push({
          severity: 'warn',
          code: 'DIAG_STEP_LABEL_WORDY',
          msg: `Step "${step.label.slice(0, 40)}..." exceeds ${MAX_STEP_WORDS} words.`,
          hint: 'Cookbook §15: step labels are headlines, not sentences.',
        })
      }
    }
  }

  // ─ 8. Mind-map depth (cookbook §12) ──────────────────────────────
  const overdeep = mindDepthExceeded(d.spec)
  if (overdeep > 0) {
    issues.push({
      severity: 'warn',
      code: 'DIAG_MIND_TOO_DEEP',
      msg: `${overdeep} mind-map node(s) deeper than 3 levels.`,
      hint: 'Cookbook §12: max 3 levels. Split into sub-mindmaps.',
    })
  }

  // ─ 9. Concept registration (typed diagrams should declare concepts) ─
  if (typed && d.sourceConcepts.length === 0) {
    issues.push({
      severity: 'info',
      code: 'DIAG_NO_CONCEPTS',
      msg: 'Typed diagram registers zero concepts; will not appear on the concept graph.',
      hint: 'Add `sourceConcepts: [...]` so the diagram is reachable from the index.',
    })
  }

  // ─ 10. Engine ↔ category coherence ───────────────────────────────
  if (typed && d.category) {
    const sane = engineMatchesCategory(engine, d.category)
    if (!sane) {
      issues.push({
        severity: 'info',
        code: 'DIAG_ENGINE_CATEGORY_MISMATCH',
        msg: `Engine "${engine}" is unusual for category "${d.category}".`,
        hint: 'Pick the engine the cookbook section recommends, unless you know what you are doing.',
      })
    }
  }

  // ─── Score ────────────────────────────────────────────────────────
  let score = 100
  let errors = 0
  for (const i of issues) {
    if (i.severity === 'error') { score -= 8; errors++ }
    else if (i.severity === 'warn') { score -= 4 }
    // info doesn't dock the score
  }
  if (score < 0) score = 0

  return { issues, score, errors }
}

/** Engine ↔ category coherence map (informs the studio picker too). */
function engineMatchesCategory(engine: string, category: DiagramCategory): boolean {
  const ok: Record<DiagramCategory, string[]> = {
    'system-architecture':    ['system', 'custom-svg'],
    'api-flow':               ['flow'],
    'database-er':            ['er'],
    'network-topology':       ['network', 'system'],
    'data-pipeline':          ['pipeline', 'system'],
    'comparison':             ['compare'],
    'cheatsheet':             ['compare', 'custom-svg'],
    'dsa-algorithm':          ['algorithm'],
    'math-proof':             ['manim', 'custom-svg'],
    'sketchnote':             ['sketch'],
    'timeline':               ['timeline'],
    'mind-map':               ['mind'],
    'process-workflow':       ['flow', 'pipeline'],
    'market-microstructure':  ['manim', 'custom-svg', 'compare'],
    'interactive-animated':   ['system', 'flow', 'algorithm', 'manim', 'custom-svg'],
  }
  return ok[category]?.includes(engine) ?? false
}
