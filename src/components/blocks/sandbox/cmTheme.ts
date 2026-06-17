import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState, type Extension } from '@codemirror/state'
import { tags as t } from '@lezer/highlight'

// The editor is APPARATUS (token law), so it stays dark in every reader theme; the
// SandboxBlock supplies the dark surface and this theme is transparent over it —
// which means a [data-theme] flip never re-mounts or re-themes CodeMirror (R9).
// 16px content font is the single most important mobile detail: iOS auto-zooms a
// contenteditable whose font is < 16px on focus (R3 / C1). NEVER lower it.
export const cmTheme = EditorView.theme(
  {
    '&': { color: 'var(--chrome-hover-text)', backgroundColor: 'transparent', fontSize: '16px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-content': { fontFamily: 'var(--font-code)', caretColor: 'var(--chrome-accent)', padding: 'var(--space-3) 0' },
    '.cm-scroller': { fontFamily: 'var(--font-code)', lineHeight: '1.6' },
    '.cm-line': { padding: '0 var(--space-4)' },
    '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--chrome-text)', border: 'none', opacity: '0.45' },
    '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--chrome-accent) 9%, transparent)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--chrome-accent)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
      backgroundColor: 'color-mix(in srgb, var(--chrome-accent) 28%, transparent)',
    },
  },
  { dark: true },
)

// A calm dark syntax palette (the editor surface is always dark).
const p = { comment: '#6b7686', key: '#8FB6DC', str: '#9ece9a', num: '#e0b078', fn: '#7aa2f7', type: '#7dcfff', op: '#9aa6c4', name: '#c8d0e8', def: '#bb9af7' }
export const cmHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [t.comment, t.lineComment, t.blockComment], color: p.comment, fontStyle: 'italic' },
    { tag: [t.keyword, t.modifier, t.controlKeyword, t.operatorKeyword, t.moduleKeyword], color: p.key },
    { tag: [t.string, t.special(t.string), t.regexp], color: p.str },
    { tag: [t.number, t.bool, t.null, t.atom], color: p.num },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: p.fn },
    { tag: [t.typeName, t.className, t.namespace], color: p.type },
    { tag: [t.operator, t.punctuation, t.bracket], color: p.op },
    { tag: [t.variableName, t.propertyName], color: p.name },
    { tag: [t.definitionKeyword, t.definition(t.variableName)], color: p.def },
  ]),
)

// 1-indexed inclusive locked lines: editable everywhere else, runnable as a whole,
// but a transaction touching a locked line is rejected.
export function lockedRegions(regions: { fromLine: number; toLine: number }[]): Extension {
  if (!regions.length) return []
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged) return tr
    let blocked = false
    tr.changes.iterChangedRanges((fromA, toA) => {
      const doc = tr.startState.doc
      const lineFrom = doc.lineAt(Math.min(fromA, doc.length)).number
      const lineTo = doc.lineAt(Math.min(toA, doc.length)).number
      for (const r of regions) if (lineFrom <= r.toLine && lineTo >= r.fromLine) blocked = true
    })
    return blocked ? [] : tr
  })
}
