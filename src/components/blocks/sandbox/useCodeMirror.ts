import { useEffect, useRef } from 'react'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { indentOnInput, bracketMatching } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { cmTheme, cmHighlight, lockedRegions } from './cmTheme'
import type { SandboxLang } from '@/lib/sandbox/types'

function langExt(lang: SandboxLang): Extension {
  if (lang === 'python') return python()
  return javascript({ typescript: lang === 'typescript', jsx: false })
}

interface Opts {
  initialDoc: string
  lang: SandboxLang
  readOnly?: boolean
  locked?: { fromLine: number; toLine: number }[]
  onRun?: () => void
}

/**
 * Imperative CodeMirror 6 ↔ React 19 bridge (~one EditorView). StrictMode-safe:
 * the effect destroys the view in cleanup, so a double-mount nets exactly one
 * instance (S4). The view is recreated ONLY when language/readOnly change — never
 * on every keystroke (that would lose the cursor); edits flow through CM's own
 * state, and Reset uses setDoc.
 */
export function useCodeMirror({ initialDoc, lang, readOnly, locked, onRun }: Opts) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onRunRef = useRef(onRun)
  onRunRef.current = onRun
  const docRef = useRef(initialDoc)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const state = EditorState.create({
      doc: docRef.current,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        keymap.of([
          { key: 'Mod-Enter', preventDefault: true, run: () => { onRunRef.current?.(); return true } },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
        langExt(lang),
        cmHighlight,
        cmTheme,
        EditorView.lineWrapping, // no horizontal-scroll trap at 360px (C2)
        EditorView.contentAttributes.of({ autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Code editor' }),
        ...(readOnly ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : []),
        ...(locked && locked.length ? [lockedRegions(locked)] : []),
      ],
    })
    const view = new EditorView({ state, parent: host })
    viewRef.current = view
    return () => { docRef.current = view.state.doc.toString(); view.destroy(); viewRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, readOnly])

  const getDoc = () => viewRef.current?.state.doc.toString() ?? docRef.current
  const setDoc = (doc: string) => {
    const v = viewRef.current
    docRef.current = doc
    if (v) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: doc } })
  }
  const focus = () => viewRef.current?.focus()
  return { hostRef, getDoc, setDoc, focus }
}
