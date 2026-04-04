import { useEffect } from 'react'

/**
 * Global keyboard shortcut hook.
 * Pass a map of key combos → handlers.
 * Use "Cmd+" prefix for Ctrl/Meta combos (e.g. "Cmd+k").
 * Ignores events when focus is in an input or textarea.
 */
export function useKeyboard(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Don't fire if typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return

      const key = [
        e.metaKey || e.ctrlKey ? 'Cmd+' : '',
        e.key,
      ].join('')

      if (shortcuts[key]) {
        e.preventDefault()
        shortcuts[key]()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts])
}
