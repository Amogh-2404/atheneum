import { chapterToMarkdown } from './markdown-export'

// ─── EPUB embedded CSS — preserves The Codex notebook aesthetic ─────

const EPUB_CSS = `
/* Body */
body {
  font-family: 'Georgia', 'Palatino', serif;
  font-size: 1rem;
  line-height: 1.75;
  color: #2c2c2c;
  background: #fefdfb;
  max-width: 42em;
  margin: 0 auto;
  padding: 1em;
}

/* Headings */
h1 {
  font-size: 2.2em;
  font-weight: 700;
  color: #1a1a1a;
  margin: 1.5em 0 0.5em 0;
  border-bottom: 2px solid #2c2c2c;
  padding-bottom: 0.3em;
}

h2 {
  font-size: 1.6em;
  font-weight: 600;
  color: #1a1a1a;
  margin: 1.2em 0 0.4em 0;
}

h3 {
  font-size: 1.3em;
  font-weight: 500;
  color: #2c2c2c;
  margin: 1em 0 0.3em 0;
}

/* Paragraphs */
p {
  margin: 0.6em 0;
}

/* Bold — marker highlight */
strong {
  font-weight: 700;
  background: linear-gradient(
    to bottom,
    transparent 40%,
    rgba(255, 235, 59, 0.3) 40%,
    rgba(255, 235, 59, 0.3) 85%,
    transparent 85%
  );
  padding: 0 2px;
}

/* Inline code */
code {
  font-family: 'Courier New', monospace;
  font-size: 0.88em;
  background: #f0f0f0;
  color: #c7254e;
  padding: 1px 4px;
  border-radius: 3px;
}

/* Code blocks — terminal style */
pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 1em;
  border-radius: 8px;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
  font-size: 0.85em;
  line-height: 1.5;
  border: 1px solid #333;
  margin: 1em 0;
}

pre code {
  background: none;
  color: #d4d4d4;
  padding: 0;
}

/* Blockquotes — callout style */
blockquote {
  border-left: 4px solid #2563eb;
  background: #eef4ff;
  margin: 1em 0;
  padding: 0.8em 1em;
  border-radius: 0 6px 6px 0;
  color: #2c2c2c;
}

blockquote.warning {
  border-left-color: #dc2626;
  background: #fef2f2;
}

blockquote.example {
  border-left-color: #16a34a;
  background: #f0fdf4;
}

blockquote.tip {
  border-left-color: #7c3aed;
  background: #f5f3ff;
}

blockquote.key-concept {
  border-left-color: #0891b2;
  background: #ecfeff;
}

/* Math blocks */
pre.math {
  background: #fafafa;
  color: #1a1a1a;
  text-align: center;
  font-style: italic;
  border: 1px solid #e5e5e5;
}

/* Tables */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 0.9em;
}

th {
  border-bottom: 2px solid #333;
  padding: 0.5em;
  text-align: left;
  font-weight: 700;
}

td {
  border-bottom: 1px solid #ddd;
  padding: 0.5em;
}

tr:nth-child(even) {
  background: #fafafa;
}

/* Lists */
li {
  margin: 0.3em 0;
}

/* Links */
a {
  color: #2563eb;
  text-decoration: underline;
}

/* Horizontal rules */
hr {
  border: none;
  border-top: 1px solid #ccc;
  margin: 1.5em 0;
}

/* Delete */
del {
  color: #888;
  text-decoration: line-through;
}

/* Images */
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1em auto;
}
`.trim()

export async function exportToEpub(book: any, chapters: any[]): Promise<Blob> {
  try {
    // Dynamic import — epub-gen-memory is large
    // @ts-ignore — epub-gen-memory types are incomplete
    const { default: EPub } = await import('epub-gen-memory')

    const epubChapters = chapters.map(ch => ({
      title: ch.title,
      data: markdownToStyledHtml(chapterToMarkdown(ch)),
    }))

    const options: any = {
      title: book.title,
      author: 'The Codex',
      description: book.description || '',
      publisher: 'The Codex Learning Platform',
      content: epubChapters,
      css: EPUB_CSS,
    }
    const epub = new (EPub as any)(options, '')

    const buffer = await epub.genEpub()
    return new Blob([buffer], { type: 'application/epub+zip' })
  } catch (err) {
    console.error('EPUB generation failed:', err)
    throw new Error(
      'EPUB export failed. This feature requires a modern browser with full ES module support. ' +
      'Try exporting as Markdown or PDF instead.'
    )
  }
}

/**
 * Convert markdown to well-structured HTML for EPUB.
 * More thorough than the previous version — produces semantic HTML with
 * proper paragraph wrapping and callout classes.
 */
function markdownToStyledHtml(md: string): string {
  // Process block-level elements first
  const lines = md.split('\n')
  const htmlLines: string[] = []
  let inCodeBlock = false
  let codeBlockLang = ''
  let codeContent: string[] = []
  let inList = false
  let listType = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code blocks
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true
        codeBlockLang = line.slice(3).trim()
        codeContent = []
        continue
      } else {
        inCodeBlock = false
        htmlLines.push(`<pre><code class="language-${codeBlockLang}">${escapeHtml(codeContent.join('\n'))}</code></pre>`)
        continue
      }
    }

    if (inCodeBlock) {
      codeContent.push(line)
      continue
    }

    // Math blocks
    if (line.startsWith('$$')) {
      const nextDollar = lines.indexOf('$$', i + 1)
      if (nextDollar > i) {
        const mathContent = lines.slice(i + 1, nextDollar).join('\n')
        htmlLines.push(`<pre class="math">${escapeHtml(mathContent)}</pre>`)
        i = nextDollar
        continue
      }
    }

    // Headings
    if (line.startsWith('### ')) {
      closeList()
      htmlLines.push(`<h3>${processInline(line.slice(4))}</h3>`)
      continue
    }
    if (line.startsWith('## ')) {
      closeList()
      htmlLines.push(`<h2>${processInline(line.slice(3))}</h2>`)
      continue
    }
    if (line.startsWith('# ')) {
      closeList()
      htmlLines.push(`<h1>${processInline(line.slice(2))}</h1>`)
      continue
    }

    // Horizontal rules
    if (line.trim() === '---') {
      closeList()
      htmlLines.push('<hr/>')
      continue
    }

    // Blockquotes (with optional class from > **VARIANT: ...)
    if (line.startsWith('> ')) {
      closeList()
      const content = line.slice(2)
      // Detect callout variant from content like > **DEFINITION: ...**
      const variantMatch = content.match(/^\*\*(DEFINITION|EXAMPLE|WARNING|KEY-CONCEPT|TIP|NOTE)/)
      const cls = variantMatch ? ` class="${variantMatch[1].toLowerCase()}"` : ''
      htmlLines.push(`<blockquote${cls}><p>${processInline(content)}</p></blockquote>`)
      continue
    }

    // Unordered lists
    if (line.startsWith('- ')) {
      if (!inList || listType !== 'ul') {
        closeList()
        inList = true
        listType = 'ul'
        htmlLines.push('<ul>')
      }
      htmlLines.push(`<li>${processInline(line.slice(2))}</li>`)
      continue
    }

    // Ordered lists
    const olMatch = line.match(/^\d+\.\s(.+)$/)
    if (olMatch) {
      if (!inList || listType !== 'ol') {
        closeList()
        inList = true
        listType = 'ol'
        htmlLines.push('<ol>')
      }
      htmlLines.push(`<li>${processInline(olMatch[1])}</li>`)
      continue
    }

    // Close list if we hit a non-list line
    if (inList) closeList()

    // Empty lines
    if (line.trim() === '') {
      continue
    }

    // Regular paragraphs
    htmlLines.push(`<p>${processInline(line)}</p>`)
  }

  // Close any open list
  closeList()

  return htmlLines.join('\n')

  function closeList() {
    if (inList) {
      htmlLines.push(listType === 'ol' ? '</ol>' : '</ul>')
      inList = false
      listType = ''
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function processInline(text: string): string {
  return text
    // Bold & italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Inline code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    // Images
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1"/>')
}
