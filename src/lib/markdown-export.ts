import type { Chapter, Block, TextContent, RichText } from '@/types'

export function chapterToMarkdown(chapter: Chapter): string {
  const lines: string[] = []
  lines.push(`# ${chapter.title}`)
  if (chapter.subtitle) lines.push(`*${chapter.subtitle}*`)
  lines.push('')

  for (const block of chapter.blocks) {
    lines.push(blockToMarkdown(block))
    lines.push('')
  }

  return lines.join('\n')
}

function blockToMarkdown(block: Block): string {
  switch (block.type) {
    case 'heading':
      return `${'#'.repeat(block.level)} ${textToMd(block.text)}`
    case 'text':
      return textToMd(block.text)
    case 'callout':
      return `> **${block.variant.toUpperCase()}${block.title ? ': ' + block.title : ''}**\n> ${textToMd(block.text)}`
    case 'code':
      return '```' + (block.language || '') + '\n' + block.code + '\n```'
    case 'quote':
      return `> ${textToMd(block.text)}${block.attribution ? '\n> \u2014 ' + block.attribution : ''}`
    case 'list':
      return listToMd(block.items, block.style)
    case 'divider':
      return '---'
    case 'math':
      return `$$\n${block.expression}\n$$`
    case 'summary':
      return `**Key Takeaways:**\n${(block.points || []).map(p => '- ' + textToMd(p)).join('\n')}`
    case 'table':
      return tableToMd(block.headers, block.rows)
    case 'timeline':
      return block.events
        .map(ev => `- **${textToMd(ev.title)}**${ev.description ? ': ' + textToMd(ev.description) : ''}`)
        .join('\n')
    case 'toggle':
      return `<details>\n<summary>${textToMd(block.title)}</summary>\n\n${block.content.map(b => blockToMarkdown(b)).join('\n\n')}\n</details>`
    case 'figure':
      return `![${block.alt}](${block.src})${block.caption ? '\n*' + textToMd(block.caption) + '*' : ''}`
    case 'embed':
      return `[${block.title || block.url}](${block.url})`
    case 'margin-annotation':
      return `> *Note:* ${textToMd(block.text)}`
    default:
      return ''
  }
}

function textToMd(content: TextContent): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return (content as RichText).map(seg => {
      let t = seg.text
      if (seg.annotations?.bold) t = `**${t}**`
      if (seg.annotations?.italic) t = `*${t}*`
      if (seg.annotations?.code) t = '`' + t + '`'
      if (seg.annotations?.strikethrough) t = `~~${t}~~`
      if (seg.href) t = `[${t}](${seg.href})`
      return t
    }).join('')
  }
  return String(content)
}

function listToMd(items: any[], style: string, depth = 0): string {
  return items.map((item, i) => {
    const prefix = style === 'ordered' ? `${i + 1}.` : '-'
    const indent = '  '.repeat(depth)
    let line = `${indent}${prefix} ${textToMd(item.text)}`
    if (item.children) line += '\n' + listToMd(item.children, style, depth + 1)
    return line
  }).join('\n')
}

function tableToMd(headers: TextContent[], rows: TextContent[][]): string {
  const headerLine = '| ' + headers.map(h => textToMd(h)).join(' | ') + ' |'
  const separator = '| ' + headers.map(() => '---').join(' | ') + ' |'
  const bodyLines = rows.map(row => '| ' + row.map(c => textToMd(c)).join(' | ') + ' |')
  return [headerLine, separator, ...bodyLines].join('\n')
}
