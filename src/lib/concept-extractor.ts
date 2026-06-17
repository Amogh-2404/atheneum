import type { TextContent } from '@/types'

// ─── Types ────────────────────────────────────────────────────────

export interface Concept {
  name: string
  definition: string
  bookId: string
  chapterId: string
  blockId: string
  /** canonical hyphenated slug = graph node id (from outline.conceptIndex) */
  slug?: string
  /** how many chapters reference it (referencedIn.length) — a truthful "seen" proxy */
  seenCount?: number
  /** prerequisite slugs (what you must know first) */
  prerequisites?: string[]
  /** dependent slugs (what builds on this) — reverse-lookup */
  dependents?: string[]
  /** true when this concept is a node in the Knowledge Map */
  inGraph?: boolean
}

export interface ConceptIndex {
  concepts: Map<string, Concept>       // de-hyphenated name -> Concept
  references: Map<string, string[]>    // de-hyphenated name -> [chapterId, ...]
  bySlug: Map<string, Concept>         // hyphenated slug -> Concept (for chip re-point + deep-link)
}

interface OutlineConceptEntry { definedIn?: string; referencedIn?: string[]; prerequisites?: string[] }
interface OutlineLike { conceptIndex?: Record<string, OutlineConceptEntry> }

// ─── Extractor ────────────────────────────────────────────────────

export function extractConcepts(bookId: string, chapters: unknown[], outline?: OutlineLike): ConceptIndex {
  const concepts = new Map<string, Concept>()
  const references = new Map<string, string[]>()
  const bySlug = new Map<string, Concept>()

  for (const ch of chapters) {
    const chapter = ch as { id?: string; blocks?: unknown[] }
    if (!chapter?.blocks) continue
    for (const b of chapter.blocks) {
      const block = b as { type?: string; variant?: string; title?: string; text?: TextContent; code?: string; items?: unknown[]; id?: string }
      // Definitions come from definition callouts
      if (block.type === 'callout' && block.variant === 'definition') {
        const name = (block.title || '').toLowerCase().trim().replace(/[-_]/g, ' ')
        if (name) {
          concepts.set(name, {
            name: block.title || name,
            definition: extractPlainText(block.text),
            bookId,
            chapterId: chapter.id || '',
            blockId: block.id || '',
          })
        }
      }

      // [[concept]] references in any block's text
      const text = getBlockText(block)
      const refs = text.match(/\[\[([^\]]+)\]\]/g)
      if (refs) {
        for (const ref of refs) {
          const raw = ref.slice(2, -2).toLowerCase().trim()
          const normalized = raw.replace(/[-_]/g, ' ')
          for (const name of new Set([raw, normalized])) {
            if (!references.has(name)) references.set(name, [])
            const arr = references.get(name)!
            if (chapter.id && !arr.includes(chapter.id)) arr.push(chapter.id)
          }
        }
      }
    }
  }

  // ── Merge the dependency graph (outline.conceptIndex) ──────────────
  // The outline is the SAME data the Knowledge Map uses. We carry BOTH key
  // spaces deliberately (G6): the de-hyphenated name (definition lookup) AND the
  // hyphenated slug (graph node id / deep-link / chip re-point). Never re-derive
  // one from the other at call time.
  const ci = outline?.conceptIndex
  if (ci) {
    // reverse-lookup: dependents[slug] = concepts that list it as a prerequisite
    const dependents = new Map<string, string[]>()
    for (const [slug, entry] of Object.entries(ci)) {
      for (const pre of entry.prerequisites || []) {
        if (!dependents.has(pre)) dependents.set(pre, [])
        dependents.get(pre)!.push(slug)
      }
    }

    for (const [slug, entry] of Object.entries(ci)) {
      const name = slug.toLowerCase().replace(/[-_]/g, ' ')
      // attach graph data to a concept that has an inline definition, or mint a
      // SYNTHETIC concept for a graph-only slug (G5: pn-junction, idm-model have
      // a node + prereqs but no definition callout) so the card still shows
      // Needs/Unlocks + the map link.
      const existing = concepts.get(name)
      const concept: Concept = existing ?? {
        name: humanize(slug),
        definition: '',
        bookId,
        chapterId: entry.definedIn || '',
        blockId: '',
      }
      concept.slug = slug
      concept.inGraph = true
      concept.seenCount = (entry.referencedIn || []).length
      concept.prerequisites = entry.prerequisites || []
      concept.dependents = dependents.get(slug) || []
      concepts.set(name, concept)
      bySlug.set(slug, concept)
    }
  }

  return { concepts, references, bySlug }
}

// ─── Helpers ──────────────────────────────────────────────────────

function humanize(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}

function extractPlainText(content: TextContent | undefined): string {
  if (content == null) return ''
  let text = ''
  if (typeof content === 'string') text = content
  else if (Array.isArray(content)) text = content.map((s: { text?: string }) => s.text || '').join('')
  return text.replace(/\[\[([^\]]+)\]\]/g, '$1')
}

function getBlockText(block: { text?: TextContent; code?: string; items?: unknown[]; title?: string; type?: string }): string {
  if (block.text) return extractPlainText(block.text)
  if (block.code) return block.code
  if (block.items) {
    return (block.items as { text?: TextContent }[]).map((item) => extractPlainText(item.text)).join(' ')
  }
  if (block.title && block.type !== 'callout') {
    return extractPlainText(block.title)
  }
  return ''
}
