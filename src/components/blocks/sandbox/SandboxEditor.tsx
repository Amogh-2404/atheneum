import { useEffect } from 'react'
import { useCodeMirror } from './useCodeMirror'
import type { SandboxLang } from '@/lib/sandbox/types'

export interface EditorApi { getDoc: () => string; setDoc: (d: string) => void; focus: () => void }

/** Lazy-loaded (React.lazy) so the whole CodeMirror chunk only downloads when a
 *  sandbox is first activated — many static sandboxes on a page stay cheap (C12). */
export default function SandboxEditor({ initialDoc, lang, readOnly, locked, onRun, apiRef }: {
  initialDoc: string
  lang: SandboxLang
  readOnly?: boolean
  locked?: { fromLine: number; toLine: number }[]
  onRun?: () => void
  apiRef: React.MutableRefObject<EditorApi | null>
}) {
  const { hostRef, getDoc, setDoc, focus } = useCodeMirror({ initialDoc, lang, readOnly, locked, onRun })
  useEffect(() => {
    apiRef.current = { getDoc, setDoc, focus }
    return () => { apiRef.current = null }
  })
  return <div ref={hostRef} style={{ width: '100%' }} />
}
