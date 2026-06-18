import { useState } from 'react'
import type { Block } from '@/types'
import ErrorBoundary from './ErrorBoundary'
import DraftIndicator from './DraftIndicator'
import HighlightLayer from '@/components/annotations/HighlightLayer'

import HeadingBlock from './HeadingBlock'
import TextBlock from './TextBlock'
import CalloutBlock from './CalloutBlock'
import CodeBlock from './CodeBlock'
import DiagramBlock from './DiagramBlock'
import FigureBlock from './FigureBlock'
import QuoteBlock from './QuoteBlock'
import ListBlock from './ListBlock'
import DividerBlock from './DividerBlock'
import MathBlock from './MathBlock'
import ReactiveMathBlock from './ReactiveMathBlock'
import TableBlock from './TableBlock'
import ToggleBlock from './ToggleBlock'
import TimelineBlock from './TimelineBlock'
import QuizBlock from './QuizBlock'
import FlashcardBlock from './FlashcardBlock'
import SummaryBlock from './SummaryBlock'
import EmbedBlock from './EmbedBlock'
import MarginAnnotationBlock from './MarginAnnotationBlock'
import SandboxBlock from './SandboxBlock'
import ScrollyFigureBlock from './ScrollyFigureBlock'
import DerivationBlock from './DerivationBlock'
import UnknownBlock from './UnknownBlock'

function renderBlock(block: Block, isFirstTextBlock?: boolean, bookId?: string, chapterId?: string) {
  switch (block.type) {
    case 'heading':
      return <HeadingBlock {...block} />
    case 'text':
      return <TextBlock {...block} isFirstInChapter={isFirstTextBlock} />
    case 'callout':
      return <CalloutBlock {...block} />
    case 'code':
      return <CodeBlock {...block} bookId={bookId} chapterId={chapterId} />
    case 'diagram':
      return <DiagramBlock {...block} />
    case 'figure':
      return <FigureBlock {...block} />
    case 'quote':
      return <QuoteBlock {...block} />
    case 'list':
      return <ListBlock {...block} />
    case 'divider':
      return <DividerBlock {...block} />
    case 'math':
      return <MathBlock {...block} />
    case 'reactive-math':
      return <ReactiveMathBlock {...block} />
    case 'table':
      return <TableBlock {...block} />
    case 'toggle':
      return <ToggleBlock {...block} />
    case 'timeline':
      return <TimelineBlock {...block} />
    case 'quiz':
      return <QuizBlock {...block} bookId={bookId} chapterId={chapterId} />
    case 'flashcard':
      return <FlashcardBlock {...block} bookId={bookId} chapterId={chapterId} />
    case 'summary':
      return <SummaryBlock {...block} />
    case 'embed':
      return <EmbedBlock {...block} />
    case 'margin-annotation':
      return <MarginAnnotationBlock {...block} />
    case 'sandbox':
      return <SandboxBlock {...block} bookId={bookId} chapterId={chapterId} />
    case 'scrolly-figure':
      return <ScrollyFigureBlock {...block} bookId={bookId} chapterId={chapterId} />
    case 'derivation':
      return <DerivationBlock {...block} bookId={bookId} chapterId={chapterId} />
    default:
      return <UnknownBlock type={(block as { type: string }).type} />
  }
}

// Block types that hold no selectable prose → no highlight layer (and no store
// subscription) is mounted for them, keeping the per-write re-render fan-out small.
const NON_HIGHLIGHTABLE = new Set([
  'divider', 'figure', 'code', 'math', 'reactive-math', 'sandbox', 'diagram',
  'embed', 'scrolly-figure', 'derivation', 'quiz', 'flashcard',
])

interface BlockRendererProps {
  block: Block
  isFirstTextBlock?: boolean
  bookId?: string
  chapterId?: string
  className?: string
  onBlockApproved?: (blockId: string) => void
  onBlockDismissed?: (blockId: string) => void
}

export default function BlockRenderer({
  block,
  isFirstTextBlock,
  bookId,
  chapterId,
  className,
  onBlockApproved,
  onBlockDismissed,
}: BlockRendererProps) {
  // Callback ref → state so the highlight overlay gets the real element once it mounts.
  const [blockEl, setBlockEl] = useState<HTMLElement | null>(null)
  return (
    <div ref={setBlockEl} id={block.id} data-block-id={block.id} className={className} style={{ position: 'relative' }}>
      {/* Non-destructive highlight overlay — never touches the prose subtree below it.
          Skipped for non-prose blocks so they don't subscribe to the annotation store. */}
      {!NON_HIGHLIGHTABLE.has(block.type) && (
        <HighlightLayer blockEl={blockEl} bookId={bookId} chapterId={chapterId} blockId={block.id} />
      )}
      <ErrorBoundary>
        <DraftIndicator
          isDraft={block.status === 'draft'}
          blockId={block.id}
          bookId={bookId}
          chapterId={chapterId}
          onApprove={onBlockApproved}
          onDismiss={onBlockDismissed}
        >
          {renderBlock(block, isFirstTextBlock, bookId, chapterId)}
        </DraftIndicator>
      </ErrorBoundary>
    </div>
  )
}
