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

function renderBlock(block: Block) {
  switch (block.type) {
    case 'heading':
      return <HeadingBlock {...block} />
    case 'text':
      return <TextBlock {...block} />
    case 'callout':
      return <CalloutBlock {...block} />
    case 'code':
      return <CodeBlock {...block} />
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
      return <QuizBlock {...block} />
    case 'flashcard':
      return <FlashcardBlock {...block} />
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

export default function BlockRenderer({ block }: { block: Block }) {
  return (
    <div id={block.id}>
      <ErrorBoundary>
        <DraftIndicator isDraft={block.status === 'draft'}>
          {renderBlock(block)}
        </DraftIndicator>
      </ErrorBoundary>
    </div>
  )
}
