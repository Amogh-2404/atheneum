import type { TextBlock as TextBlockType } from '@/types'
import { renderText } from '@/lib/render-text'

interface TextBlockProps extends TextBlockType {
  /** First text block in a chapter gets the drop-cap treatment */
  isFirstInChapter?: boolean
}

export default function TextBlock({ text, isFirstInChapter }: TextBlockProps) {
  return (
    <p className={`notebook-text${isFirstInChapter ? ' drop-cap' : ''}`}>
      {renderText(text)}
    </p>
  )
}
