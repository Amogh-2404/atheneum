// ─── Rich Text Model ───────────────────────────────────────────────

export interface RichTextSegment {
  text: string
  annotations?: {
    bold?: boolean
    italic?: boolean
    code?: boolean
    strikethrough?: boolean
    underline?: boolean
    color?: string
  }
  href?: string
}

export type RichText = RichTextSegment[]

/** Blocks can use either a RichText array or a markdown string shorthand */
export type TextContent = RichText | string

// ─── List Item (recursive) ─────────────────────────────────────────

export interface ListItem {
  text: TextContent
  children?: ListItem[]
}

// ─── Block Base ────────────────────────────────────────────────────

export interface BlockBase {
  id: string
  type: string
  status?: 'draft' | 'published'
  metadata?: {
    createdAt?: string
    updatedAt?: string
    insertedAfter?: string
    movedFrom?: string
  }
}

// ─── 18 Block Types ────────────────────────────────────────────────

export interface HeadingBlock extends BlockBase {
  type: 'heading'
  level: 1 | 2 | 3
  text: TextContent
  anchor?: string
}

export interface TextBlock extends BlockBase {
  type: 'text'
  text: TextContent
}

export interface CalloutBlock extends BlockBase {
  type: 'callout'
  variant: 'tip' | 'warning' | 'key-concept' | 'example' | 'definition' | 'note'
  title?: string
  text: TextContent
  icon?: string
}

export interface CodeBlock extends BlockBase {
  type: 'code'
  language: string
  code: string
  filename?: string
  highlightLines?: number[]
  annotations?: Record<number, string>
  showLineNumbers?: boolean
  tiltSeed?: number
}

export interface DiagramBlock extends BlockBase {
  type: 'diagram'
  diagramFile?: string
  inlineData?: unknown
  caption?: TextContent
  width?: 'narrow' | 'medium' | 'full'
}

export interface FigureBlock extends BlockBase {
  type: 'figure'
  src: string
  alt: string
  caption?: TextContent
  layout: 'full' | 'left' | 'right' | 'center'
  width?: string
}

export interface QuoteBlock extends BlockBase {
  type: 'quote'
  text: TextContent
  attribution?: string
  source?: string
}

export interface ListBlock extends BlockBase {
  type: 'list'
  style: 'ordered' | 'unordered'
  items: ListItem[]
}

export interface DividerBlock extends BlockBase {
  type: 'divider'
  style?: 'line' | 'dots' | 'wave' | 'flourish'
}

export interface MathBlock extends BlockBase {
  type: 'math'
  expression: string
  display?: boolean
}

export interface TableBlock extends BlockBase {
  type: 'table'
  headers: TextContent[]
  rows: TextContent[][]
  caption?: string
}

export interface ToggleBlock extends BlockBase {
  type: 'toggle'
  title: TextContent
  content: Block[]
}

export interface TimelineBlock extends BlockBase {
  type: 'timeline'
  events: Array<{
    title: TextContent
    description?: TextContent
    icon?: string
  }>
}

export interface QuizBlock extends BlockBase {
  type: 'quiz'
  questions: Array<{
    id: string
    question: TextContent
    options: TextContent[]
    correctIndex: number
    explanation: TextContent
  }>
}

export interface FlashcardBlock extends BlockBase {
  type: 'flashcard'
  cards: Array<{
    front: TextContent
    back: TextContent
    category?: string
  }>
}

export interface SummaryBlock extends BlockBase {
  type: 'summary'
  points: TextContent[]
}

export interface EmbedBlock extends BlockBase {
  type: 'embed'
  url: string
  title?: string
  description?: string
}

export interface MarginAnnotationBlock extends BlockBase {
  type: 'margin-annotation'
  text: TextContent
  author?: string
}

// ─── Discriminated Union ───────────────────────────────────────────

export type Block =
  | HeadingBlock
  | TextBlock
  | CalloutBlock
  | CodeBlock
  | DiagramBlock
  | FigureBlock
  | QuoteBlock
  | ListBlock
  | DividerBlock
  | MathBlock
  | TableBlock
  | ToggleBlock
  | TimelineBlock
  | QuizBlock
  | FlashcardBlock
  | SummaryBlock
  | EmbedBlock
  | MarginAnnotationBlock
