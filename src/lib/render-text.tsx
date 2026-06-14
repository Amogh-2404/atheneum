import type { TextContent, RichText, RichTextSegment } from '@/types'

/**
 * Convert TextContent (markdown string OR RichText array) into React elements.
 */
export function renderText(content: TextContent | undefined): React.ReactNode {
  if (content == null) return null

  if (typeof content === 'string') {
    return parseMarkdownInline(content)
  }

  return (content as RichText).map((seg, i) => renderSegment(seg, i))
}

// ─── Markdown Inline Parser ─────────────────────────────────────────

type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string }
  | { type: 'concept'; value: string }
  | { type: 'link'; text: string; url: string }

function tokenize(input: string): InlineToken[] {
  const tokens: InlineToken[] = []
  // Order matters: bold (**) before italic (*), concept [[]] before link []()
  const pattern =
    /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`]+?)`)|(\[\[(.+?)\]\])|(\[(.+?)\]\((.+?)\))/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(input)) !== null) {
    // Push any text before this match
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: input.slice(lastIndex, match.index) })
    }

    if (match[1]) {
      // **bold**
      tokens.push({ type: 'bold', value: match[2] })
    } else if (match[3]) {
      // *italic*
      tokens.push({ type: 'italic', value: match[4] })
    } else if (match[5]) {
      // `code`
      tokens.push({ type: 'code', value: match[6] })
    } else if (match[7]) {
      // [[concept]]
      tokens.push({ type: 'concept', value: match[8] })
    } else if (match[9]) {
      // [text](url)
      tokens.push({ type: 'link', text: match[10], url: match[11] })
    }

    lastIndex = match.index + match[0].length
  }

  // Push any remaining text
  if (lastIndex < input.length) {
    tokens.push({ type: 'text', value: input.slice(lastIndex) })
  }

  return tokens
}

function parseMarkdownInline(text: string): React.ReactNode {
  const tokens = tokenize(text)

  if (tokens.length === 0) return text
  if (tokens.length === 1 && tokens[0].type === 'text') return tokens[0].value

  return tokens.map((token, i) => {
    switch (token.type) {
      case 'text':
        return <span key={i}>{token.value}</span>
      case 'bold':
        return (
          <strong key={i}>
            {parseMarkdownInline(token.value)}
          </strong>
        )
      case 'italic':
        return (
          <em key={i} className="italic">
            {parseMarkdownInline(token.value)}
          </em>
        )
      case 'code':
        return (
          <code
            key={i}
            className="rounded bg-[var(--code-bg)] px-1.5 py-0.5 text-sm font-mono text-[var(--text-h)]"
          >
            {token.value}
          </code>
        )
      case 'concept':
        return (
          <span
            key={i}
            className="concept-ref cursor-pointer border-b border-cyan-400 text-cyan-500 dark:text-cyan-400"
            data-concept={token.value.toLowerCase().trim()}
            title={`Concept: ${token.value}`}
          >
            {token.value}
          </span>
        )
      case 'link':
        return (
          <a
            key={i}
            href={token.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {token.text}
          </a>
        )
    }
  })
}

// ─── RichText Segment Renderer ──────────────────────────────────────

function renderSegment(seg: RichTextSegment, key: number): React.ReactNode {
  const { text, annotations, href } = seg

  // Parse [[concept]] references even inside RichText segments
  let node: React.ReactNode = text.includes('[[')
    ? parseMarkdownInline(text)
    : text

  if (annotations) {
    const classes: string[] = []
    const style: React.CSSProperties = {}

    if (annotations.bold) classes.push('font-bold')
    if (annotations.italic) classes.push('italic')
    if (annotations.code)
      classes.push(
        'rounded',
        'bg-[var(--code-bg)]',
        'px-1.5',
        'py-0.5',
        'text-sm',
        'font-mono'
      )
    if (annotations.strikethrough) classes.push('line-through')
    if (annotations.underline) classes.push('underline')
    if (annotations.color) style.color = annotations.color

    if (classes.length > 0 || Object.keys(style).length > 0) {
      node = (
        <span className={classes.join(' ')} style={style}>
          {text}
        </span>
      )
    }
  }

  if (href) {
    return (
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {node}
      </a>
    )
  }

  // If node was wrapped in a span, it already has a key from React
  // We need to key it at the top level for the .map() caller
  if (node === text) {
    return <span key={key}>{text}</span>
  }

  // Clone with key
  return (
    <span key={key}>
      {node}
    </span>
  )
}
