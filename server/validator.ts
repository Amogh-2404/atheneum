import { z } from 'zod'

// ─── Rich Text ─────────────────────────────────────────────────────

const RichTextSegmentSchema = z.object({
  text: z.string(),
  annotations: z.object({
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    code: z.boolean().optional(),
    strikethrough: z.boolean().optional(),
    underline: z.boolean().optional(),
    color: z.string().optional(),
  }).optional(),
  href: z.string().optional(),
})

const TextContentSchema = z.union([
  z.string(),
  z.array(RichTextSegmentSchema),
])

// ─── Block Base ────────────────────────────────────────────────────

const BlockBaseSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.enum(['draft', 'published']).optional(),
  metadata: z.object({
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    insertedAfter: z.string().optional(),
    movedFrom: z.string().optional(),
  }).optional(),
})

// ─── List Item (recursive) ────────────────────────────────────────

const ListItemSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    text: TextContentSchema,
    children: z.array(ListItemSchema).optional(),
  })
)

// ─── Individual Block Schemas ─────────────────────────────────────

const HeadingBlockSchema = BlockBaseSchema.extend({
  type: z.literal('heading'),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  text: TextContentSchema,
  anchor: z.string().optional(),
})

const TextBlockSchema = BlockBaseSchema.extend({
  type: z.literal('text'),
  text: TextContentSchema,
})

const CalloutBlockSchema = BlockBaseSchema.extend({
  type: z.literal('callout'),
  variant: z.enum(['tip', 'warning', 'key-concept', 'example', 'definition', 'note']),
  title: z.string().optional(),
  text: TextContentSchema,
  icon: z.string().optional(),
})

const CodeBlockSchema = BlockBaseSchema.extend({
  type: z.literal('code'),
  language: z.string(),
  code: z.string(),
  filename: z.string().optional(),
  highlightLines: z.array(z.number()).optional(),
  annotations: z.record(z.string(), z.string()).optional(),
  showLineNumbers: z.boolean().optional(),
  tiltSeed: z.number().optional(),
})

const DiagramBlockSchema = BlockBaseSchema.extend({
  type: z.literal('diagram'),
  diagramFile: z.string().optional(),
  inlineData: z.unknown().optional(),
  caption: TextContentSchema.optional(),
  width: z.enum(['narrow', 'medium', 'full', 'wide']).optional(),
})

const FigureBlockSchema = BlockBaseSchema.extend({
  type: z.literal('figure'),
  src: z.string(),
  alt: z.string(),
  caption: TextContentSchema.optional(),
  layout: z.enum(['full', 'left', 'right', 'center']),
  width: z.string().optional(),
})

const QuoteBlockSchema = BlockBaseSchema.extend({
  type: z.literal('quote'),
  text: TextContentSchema,
  attribution: z.string().optional(),
  source: z.string().optional(),
})

const ListBlockSchema = BlockBaseSchema.extend({
  type: z.literal('list'),
  style: z.enum(['ordered', 'unordered']),
  items: z.array(ListItemSchema),
})

const DividerBlockSchema = BlockBaseSchema.extend({
  type: z.literal('divider'),
  style: z.enum(['line', 'dots', 'wave', 'flourish']).optional(),
})

const MathBlockSchema = BlockBaseSchema.extend({
  type: z.literal('math'),
  expression: z.string(),
  display: z.boolean().optional(),
})

const TableBlockSchema = BlockBaseSchema.extend({
  type: z.literal('table'),
  headers: z.array(TextContentSchema),
  rows: z.array(z.array(TextContentSchema)),
  caption: z.string().optional(),
})

const ToggleBlockSchema: z.ZodType<any> = z.lazy(() =>
  BlockBaseSchema.extend({
    type: z.literal('toggle'),
    title: TextContentSchema,
    content: z.array(BlockSchema),
  })
)

const TimelineBlockSchema = BlockBaseSchema.extend({
  type: z.literal('timeline'),
  events: z.array(z.object({
    title: TextContentSchema,
    description: TextContentSchema.optional(),
    icon: z.string().optional(),
  })),
})

const QuizBlockSchema = BlockBaseSchema.extend({
  type: z.literal('quiz'),
  questions: z.array(z.object({
    id: z.string(),
    question: TextContentSchema,
    options: z.array(TextContentSchema),
    correctIndex: z.number(),
    explanation: TextContentSchema,
  })),
})

const FlashcardBlockSchema = BlockBaseSchema.extend({
  type: z.literal('flashcard'),
  cards: z.array(z.object({
    front: TextContentSchema,
    back: TextContentSchema,
    category: z.string().optional(),
  })),
})

const SummaryBlockSchema = BlockBaseSchema.extend({
  type: z.literal('summary'),
  points: z.array(TextContentSchema),
})

const EmbedBlockSchema = BlockBaseSchema.extend({
  type: z.literal('embed'),
  url: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
})

const MarginAnnotationBlockSchema = BlockBaseSchema.extend({
  type: z.literal('margin-annotation'),
  text: TextContentSchema,
  author: z.string().optional(),
})

// ─── Discriminated Union ──────────────────────────────────────────

const BlockSchema = z.discriminatedUnion('type', [
  HeadingBlockSchema,
  TextBlockSchema,
  CalloutBlockSchema,
  CodeBlockSchema,
  DiagramBlockSchema,
  FigureBlockSchema,
  QuoteBlockSchema,
  ListBlockSchema,
  DividerBlockSchema,
  MathBlockSchema,
  TableBlockSchema,
  ToggleBlockSchema,
  TimelineBlockSchema,
  QuizBlockSchema,
  FlashcardBlockSchema,
  SummaryBlockSchema,
  EmbedBlockSchema,
  MarginAnnotationBlockSchema,
])

// ─── Chapter ──────────────────────────────────────────────────────

const ChapterSchema = z.object({
  _schema: z.number().optional(),
  id: z.string(),
  number: z.number().optional(),
  title: z.string(),
  subtitle: z.string().optional(),
  estimatedReadMinutes: z.number().optional(),
  blockCount: z.number().optional(),
  blocks: z.array(BlockSchema),
}).passthrough() // allow extra fields we don't know about

// ─── Book ─────────────────────────────────────────────────────────

const BookSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  coverColor: z.string().optional(),
  coverIcon: z.string().optional(),
  tags: z.array(z.string()).optional(),
  chapterCount: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough()

// ─── Outline ──────────────────────────────────────────────────────

const OutlineSchema = z.object({
  chapters: z.array(z.object({
    id: z.string(),
    title: z.string(),
    concepts: z.array(z.string()).optional(),
    prereqs: z.array(z.string()).optional(),
    estimatedBlocks: z.number().optional(),
    status: z.enum(['planned', 'writing', 'complete']).optional(),
  }).passthrough()).optional(),
  conceptIndex: z.record(z.string(), z.any()).optional(),
}).passthrough()

// ─── Validation Functions ─────────────────────────────────────────

export interface ValidationResult<T> {
  success: boolean
  data?: T
  errors?: string[]
}

export function validateChapter(data: unknown): ValidationResult<any> {
  const result = ChapterSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errors = result.error.errors.map(e =>
    `${e.path.join('.')}: ${e.message}`
  )
  console.warn(`[validator] Chapter validation failed:`, errors.slice(0, 5))
  return { success: false, errors }
}

export function validateBook(data: unknown): ValidationResult<any> {
  const result = BookSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errors = result.error.errors.map(e =>
    `${e.path.join('.')}: ${e.message}`
  )
  console.warn(`[validator] Book validation failed:`, errors.slice(0, 5))
  return { success: false, errors }
}

export function validateOutline(data: unknown): ValidationResult<any> {
  const result = OutlineSchema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const errors = result.error.errors.map(e =>
    `${e.path.join('.')}: ${e.message}`
  )
  console.warn(`[validator] Outline validation failed:`, errors.slice(0, 5))
  return { success: false, errors }
}

/**
 * Validate a chapter but still return the raw data even if validation fails.
 * This allows graceful degradation — serve what we can, log warnings.
 */
export function validateChapterGraceful(raw: any): any {
  const result = validateChapter(raw)
  if (!result.success) {
    console.warn(`[validator] Serving chapter despite validation errors (graceful mode)`)
  }
  // Always return the raw data — validation is advisory, not blocking
  return raw
}
