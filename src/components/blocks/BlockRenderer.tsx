import type { Block } from '@/types'
import ErrorBoundary from './ErrorBoundary'
import DraftIndicator from './DraftIndicator'

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
import TableBlock from './TableBlock'
import ToggleBlock from './ToggleBlock'
import TimelineBlock from './TimelineBlock'
import QuizBlock from './QuizBlock'
import FlashcardBlock from './FlashcardBlock'
import SummaryBlock from './SummaryBlock'
import EmbedBlock from './EmbedBlock'
import MarginAnnotationBlock from './MarginAnnotationBlock'
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
    default:
      return <UnknownBlock type={(block as { type: string }).type} />
  }
}

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
  return (
    <div id={block.id} className={className}>
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
