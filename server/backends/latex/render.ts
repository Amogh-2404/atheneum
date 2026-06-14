/* ─── Per-block LaTeX rendering ──────────────────────────────────────────────
   Pure: Block → string of LaTeX. One function per block type.
   Handles: heading, text, callout, code, math, list, table, figure, quote,
            divider, summary, flashcard, quiz, timeline, toggle, embed,
            margin-annotation, diagram (custom-svg + sketch).
───────────────────────────────────────────────────────────────────────────── */

import type { Block, ListItem } from '../../../src/types/blocks.ts'
import type { DiagramBlock } from '../../../src/types/diagrams.ts'
import { escapeLaTeX, mdToLaTeX, renderTextContent } from './escape.ts'

const HEADING_TO_CMD: Record<1 | 2 | 3, string> = {
  1: '\\section*',     // chapter title is emitted by chapterOpener; H1 inside body becomes section
  2: '\\section',
  3: '\\subsection',
}

/** Render a single block. Returns LaTeX (may be multi-line). */
export function renderBlock(b: Block, opts: { isFirstBody: boolean }): string {
  switch (b.type) {
    case 'heading': {
      const level = (b.level ?? 2) as 1 | 2 | 3
      const cmd = HEADING_TO_CMD[level] ?? '\\section'
      const text = renderTextContent(b.text)
      return `${cmd}{${text}}\n`
    }

    case 'text': {
      const text = renderTextContent(b.text)
      // Optional drop cap on the first body paragraph of a chapter.
      if (opts.isFirstBody && typeof text === 'string' && text.length > 80) {
        const m = text.match(/^([A-Za-z])(.*)$/s)
        if (m) {
          return `\\lettrine[lines=2,findent=2pt,nindent=0pt]{${m[1]}}{${m[2].slice(0, 8).toUpperCase()}}${m[2].slice(8)}\n\n`
        }
      }
      return `${text}\n\n`
    }

    case 'callout': {
      const env = calloutEnv(b.variant)
      const title = b.title ? `[title={${escapeLaTeX(b.title)}}]` : ''
      const body = renderTextContent(b.text)
      return `\\begin{${env}}${title}\n${body}\n\\end{${env}}\n\n`
    }

    case 'code': {
      const lang = mintedLang(b.language ?? 'text')
      const code = b.code ?? ''
      // Escape any \end{minted} that might appear in the body.
      const safe = code.replace(/\\end\{minted\}/g, '\\\\end{minted}')
      return `\\begin{minted}{${lang}}\n${safe}\n\\end{minted}\n\n`
    }

    case 'math': {
      const expr = (b.expression ?? '').trim()
      if (!expr) return ''
      return b.display === false
        ? `$${expr}$\n\n`
        : `\\[\n${expr}\n\\]\n\n`
    }

    case 'list': {
      const env = b.style === 'ordered' ? 'enumerate' : 'itemize'
      const items = Array.isArray(b.items) ? b.items : []
      if (items.length === 0) return ''
      return `\\begin{${env}}\n${renderItems(items)}\\end{${env}}\n\n`
    }

    case 'table': {
      const headers = b.headers ?? []
      const rows = b.rows ?? []
      if (headers.length === 0 && rows.length === 0) return ''
      const col = 'l'.repeat(Math.max(headers.length, rows[0]?.length ?? 1))
      const headRow = headers.map(h => `\\textbf{${renderTextContent(h)}}`).join(' & ')
      const bodyRows = rows.map(r => r.map(c => renderTextContent(c)).join(' & ')).join(' \\\\\n')
      return `\\begin{center}\\begin{tabular}{${col}}\n\\hline\n${headRow} \\\\\n\\hline\n${bodyRows}${rows.length ? ' \\\\' : ''}\n\\hline\n\\end{tabular}\\end{center}\n\n`
    }

    case 'figure': {
      const src = b.src ?? ''
      const cap = renderTextContent(b.caption ?? b.alt)
      // We don't actually copy images at render time — the build runner
      // will set up symlinks under the build dir before invoking lualatex.
      const safeSrc = src.replace(/^\/content\//, '../../content/').replace(/[^\w./-]/g, '')
      return `\\begin{figure}[h]\\centering\n\\includegraphics[width=0.85\\textwidth]{${safeSrc}}\n\\caption*{\\itshape ${cap}}\n\\end{figure}\n\n`
    }

    case 'quote': {
      const text = renderTextContent(b.text)
      const attr = b.attribution ? ` --- \\textsc{${escapeLaTeX(b.attribution)}}` : ''
      return `\\begin{quote}\\itshape\n${text}${attr}\n\\end{quote}\n\n`
    }

    case 'divider': {
      return `\\athornament\n\n`
    }

    case 'summary': {
      const items = (b.points ?? []).map(p => `\\item ${renderTextContent(p)}`).join('\n')
      return `\\begin{keybox}[title={Key takeaways}]\n\\begin{itemize}\n${items}\n\\end{itemize}\n\\end{keybox}\n\n`
    }

    case 'flashcard': {
      const cards = b.cards ?? []
      if (cards.length === 0) return ''
      // Render compactly as a description list — Q in bold, A indented.
      const items = cards.map(c =>
        `\\item[\\textbf{Q.}] ${renderTextContent(c.front)}\\\\\n\\textbf{A.}\\enspace ${renderTextContent(c.back)}`
      ).join('\n\n')
      return `\\begin{description}\n${items}\n\\end{description}\n\n`
    }

    case 'quiz': {
      const qs = b.questions ?? []
      if (qs.length === 0) return ''
      const blocks = qs.map((q, i) => {
        const opts = (q.options ?? []).map((o, j) => {
          const mark = j === q.correctIndex ? '\\textbf{✓}' : '\\phantom{✓}'
          return `\\item[${mark}] ${renderTextContent(o)}`
        }).join('\n')
        return `\\textbf{Q${i + 1}.} ${renderTextContent(q.question)}\n\\begin{description}\n${opts}\n\\end{description}\n\\emph{${renderTextContent(q.explanation)}}`
      }).join('\n\n')
      return `${blocks}\n\n`
    }

    case 'timeline': {
      const ev = b.events ?? []
      if (ev.length === 0) return ''
      const items = ev.map(e => {
        const desc = e.description ? `\\\\${renderTextContent(e.description)}` : ''
        return `\\item \\textbf{${renderTextContent(e.title)}}${desc}`
      }).join('\n')
      return `\\begin{itemize}\n${items}\n\\end{itemize}\n\n`
    }

    case 'toggle': {
      const content = Array.isArray(b.content) ? b.content : []
      const inner = content.map(c => renderBlock(c, { isFirstBody: false })).join('')
      return `\\begin{notebox}[title={${renderTextContent(b.title)}}]\n${inner}\\end{notebox}\n\n`
    }

    case 'embed': {
      return `\\begin{notebox}\n\\textsc{Embed:} \\href{${(b.url ?? '').replace(/[%#]/g, c => `\\${c}`)}}{${escapeLaTeX(b.title ?? b.url ?? '')}}\\\\\n${escapeLaTeX(b.description ?? '')}\n\\end{notebox}\n\n`
    }

    case 'margin-annotation': {
      // memoir's \marginpar — author's voice in the margin
      return `\\marginpar{\\sffamily\\footnotesize\\itshape ${renderTextContent(b.text)}}\n`
    }

    case 'diagram': {
      return renderDiagram(b as DiagramBlock)
    }

    default:
      return `% (unrendered block type: ${(b as { type: string }).type})\n`
  }
}

function renderItems(items: readonly ListItem[]): string {
  return items.map(it => {
    const text = renderTextContent(it.text)
    if (it.children && it.children.length > 0) {
      return `\\item ${text}\n\\begin{itemize}\n${renderItems(it.children)}\\end{itemize}\n`
    }
    return `\\item ${text}\n`
  }).join('')
}

function calloutEnv(variant: string): string {
  switch (variant) {
    case 'tip':         return 'tipbox'
    case 'warning':     return 'warnbox'
    case 'key-concept': return 'keybox'
    case 'example':     return 'exbox'
    case 'definition':  return 'defbox'
    default:            return 'notebox'
  }
}

/** Map our IR languages to minted lexer names. */
function mintedLang(l: string): string {
  const map: Record<string, string> = {
    cpp: 'cpp', c: 'c', python: 'python', javascript: 'javascript',
    typescript: 'typescript', tsx: 'typescript', go: 'go', rust: 'rust',
    bash: 'bash', sh: 'bash', json: 'json', yaml: 'yaml', sql: 'sql',
    diff: 'diff', cmake: 'cmake', makefile: 'make',
    // No first-class lexer for these — fall back to text:
    llvm: 'llvm', mlir: 'text', mir: 'text', tablegen: 'text', hexagon: 'gas',
    asm: 'gas', pseudocode: 'text', text: 'text', txt: 'text', '': 'text',
  }
  return map[l.toLowerCase()] ?? 'text'
}

/** Diagram rendering — for now we support `custom-svg` (inline SVG via
 *  svg package fallback to a text placeholder) and `sketch` (Excalidraw
 *  rendered to an external PNG by the build runner; we just \includegraphics). */
function renderDiagram(d: DiagramBlock): string {
  const cap = d.caption ? `\\caption*{\\itshape ${escapeLaTeX(typeof d.caption === 'string' ? d.caption : '')}}` : ''
  if (d.spec?.engine === 'custom-svg') {
    // Embed as a verbatim listing for now — full TikZ port comes in C.5.
    return `\\begin{figure}[h]\\centering\n\\fbox{\\parbox{0.85\\textwidth}{\\centering\\sffamily\\small\\itshape Custom-SVG diagram (rendered in web reader; PDF inline rendering ships in Phase C.5).}}\n${cap}\n\\end{figure}\n\n`
  }
  if (d.diagramFile || d.inlineData) {
    return `\\begin{figure}[h]\\centering\n\\fbox{\\parbox{0.85\\textwidth}{\\centering\\sffamily\\small\\itshape Excalidraw diagram (rendered in web reader; PDF inline rendering ships in Phase C.5).}}\n${cap}\n\\end{figure}\n\n`
  }
  return `% diagram (unrenderable in PDF yet)\n`
}
