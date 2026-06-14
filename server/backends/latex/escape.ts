/* ─── LaTeX text escaping + inline markdown rendering ───────────────────────
   Pure utilities. Used by every block renderer.
───────────────────────────────────────────────────────────────────────────── */

import type { TextContent, RichText } from '../../../src/types/blocks.ts'

/** Escape arbitrary text for LaTeX. Order matters — escape backslash first. */
export function escapeLaTeX(s: string): string {
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/</g, '\\textless{}')
    .replace(/>/g, '\\textgreater{}')
    .replace(/"/g, "''")
    // Smart quotes — TeX-style, applied after the dumb one above
    .replace(/'([^']+)'/g, "`$1'")
}

/** Light inline markdown → LaTeX:
 *  **bold** _italic_ `code` [text](url) — and concept refs [[concept]].
 *
 *  Strategy: protect markdown constructs as PLACEHOLDERS, escape the
 *  remaining text's LaTeX specials, then restore placeholders with their
 *  rendered LaTeX forms. This way plain text inside RichText segments
 *  (which never goes through markdown matching) still gets safe escapes
 *  for &, %, $, #, ~, ^, {, }.
 */
export function mdToLaTeX(s: string): string {
  if (!s) return ''
  const placeholders: string[] = []
  const stash = (latex: string): string => {
    placeholders.push(latex)
    return `${placeholders.length - 1}`
  }

  let out = s

  // 1. Stash inline code `...` first — its body needs CODE-flavor escape.
  out = out.replace(/`([^`]+)`/g, (_m, code) => stash(`\\code{${escapeInlineCode(code)}}`))

  // 2. Concept refs [[slug]] — already-clean ASCII identifier, no escape needed.
  out = out.replace(/\[\[([a-z0-9][a-z0-9-]*)\]\]/g, (_m, slug) => stash(`\\conceptref{${slug}}`))

  // 3. Markdown links [text](url) → \href — escape link text via inline-text rule.
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text, url) => {
    const safeUrl = url.replace(/([%#\\])/g, '\\$1')
    return stash(`\\href{${safeUrl}}{${escapeInlineText(text)}}`)
  })

  // 4. Bold **text** → \textbf{...} (escape body text first)
  out = out.replace(/\*\*([^*]+)\*\*/g, (_m, t) => stash(`\\textbf{${escapeInlineText(t)}}`))

  // 5. Italic *text* / _text_ — escape body text first
  out = out.replace(/(?<![*\\])\*([^*\n]+)\*(?!\*)/g, (_m, t) => stash(`\\emph{${escapeInlineText(t)}}`))
  out = out.replace(/(?<![\w\\])_([^_\n]+)_(?!\w)/g, (_m, t) => stash(`\\emph{${escapeInlineText(t)}}`))

  // 6. Now escape LaTeX specials in the remaining plain text. We do NOT
  //    escape `_`, `*`, `[`, `]`, `(`, `)` since those rarely conflict in
  //    body text and stripping them changes meaning. We DO escape the
  //    LaTeX-active set: & % $ # { } ~ ^ \
  out = out
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')

  // 7. Em / en dashes (Unicode).
  out = out.replace(/—/g, '---').replace(/–/g, '--')

  // 8. Restore placeholders (in reverse so larger indices don't shift).
  out = out.replace(/(\d+)/g, (_m, idx) => placeholders[Number(idx)] ?? '')

  return out
}

/** Escape inline text that may already contain LaTeX commands from
 *  upstream (e.g., when nesting bold inside link text). Does not escape
 *  backslashes since they may belong to commands. */
function escapeInlineText(s: string): string {
  return s
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
}

/** Escape code for inline `\code{}` — preserve almost everything. */
function escapeInlineCode(s: string): string {
  return s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
}

/** Convert a TextContent (string or RichText) into a LaTeX-ready string. */
export function renderTextContent(t: TextContent | undefined | null): string {
  if (t === undefined || t === null) return ''
  if (typeof t === 'string') return mdToLaTeX(t)
  if (Array.isArray(t)) {
    return t.map(seg => renderRichSegment(seg)).join('')
  }
  return ''
}

function renderRichSegment(seg: RichText[number]): string {
  let out = mdToLaTeX(seg.text ?? '')
  const a = seg.annotations ?? {}
  if (a.code) out = `\\code{${out}}`
  if (a.bold) out = `\\textbf{${out}}`
  if (a.italic) out = `\\emph{${out}}`
  if (a.underline) out = `\\underline{${out}}`
  if (a.strikethrough) out = `\\sout{${out}}`
  if (a.color && /^#[0-9A-Fa-f]{6}$/.test(a.color)) {
    out = `\\textcolor[HTML]{${a.color.slice(1)}}{${out}}`
  }
  if (seg.href) out = `\\href{${seg.href}}{${out}}`
  return out
}
