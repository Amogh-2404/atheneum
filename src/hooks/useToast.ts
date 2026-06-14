/* ─── Toast Hook ───────────────────────────────────────────────────────
   Lightweight global toast notification system.
   Usage:
     const { toast } = useToast()
     toast('Copied!', 'success')
────────────────────────────────────────────────────────────────────── */

import { useSyncExternalStore, useCallback } from 'react'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
  createdAt: number
}

const MAX_TOASTS = 3
const AUTO_DISMISS_MS: Record<ToastVariant, number> = {
  success: 2500,
  info: 3000,
  error: 5000,
}

// ─── Global store (singleton, no Context needed) ─────────────────────

let toasts: ToastItem[] = []
let listeners: Set<() => void> = new Set()

function emitChange() {
  for (const fn of listeners) fn()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot(): ToastItem[] {
  return toasts
}

function addToast(message: string, variant: ToastVariant = 'info') {
  const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const item: ToastItem = { id, message, variant, createdAt: Date.now() }

  toasts = [...toasts, item].slice(-MAX_TOASTS)
  emitChange()

  // Auto-dismiss
  setTimeout(() => removeToast(id), AUTO_DISMISS_MS[variant])
}

function removeToast(id: string) {
  const before = toasts.length
  toasts = toasts.filter((t) => t.id !== id)
  if (toasts.length !== before) emitChange()
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useToast() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const toast = useCallback((message: string, variant: ToastVariant = 'info') => {
    addToast(message, variant)
  }, [])

  return { toasts: items, toast, removeToast }
}

// Export for direct use without hook (e.g., in non-component code)
export { addToast, removeToast }
