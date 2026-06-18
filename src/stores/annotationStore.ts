// The single reactive source of truth for annotations (highlights, bookmarks, margin
// notes, confusion markers). A module-level store exposed via useSyncExternalStore — the
// Reader's overlay, the Reader's hit-test, and the Notebook all subscribe to THIS, so an
// add/delete in one surface is live in the others, in-session, with no reload.
// localStorage stays as the offline mirror (key + shape unchanged — PreferencesPanel
// reads it). The SQLite REST contract is untouched; cross-device sync (WS) layers on top.

/* ─── Types (re-exported by useAnnotations so the 6 importers don't move) ─── */

export interface Highlight {
  id: string
  type: 'highlight'
  bookId: string
  chapterId: string
  blockId: string
  startOffset: number
  endOffset: number
  selectedText: string
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple'
  note?: string
  createdAt: string
}
export interface Bookmark {
  id: string
  type: 'bookmark'
  bookId: string
  chapterId: string
  blockId: string
  label?: string
  createdAt: string
}
export interface MarginNote {
  id: string
  type: 'margin-note'
  bookId: string
  chapterId: string
  blockId: string
  text: string
  createdAt: string
}
export interface ConfusionMarker {
  id: string
  type: 'confusion'
  bookId: string
  chapterId: string
  blockId: string
  note?: string
  createdAt: string
}
export type Annotation = Highlight | Bookmark | MarginNote | ConfusionMarker

/* ─── localStorage mirror (unchanged key + shape) ─────────────────────── */

const STORAGE_KEY = 'atheneum-annotations'

function loadFromStorage(): Annotation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/* ─── Server sync helpers (moved verbatim from the old useAnnotations.ts) ─── */

function syncAnnotationsToServer(
  bookId: string,
  annotations: Annotation[],
): Promise<{ synced: number; total: number }> {
  const bookAnnotations = annotations.filter((a) => a.bookId === bookId)
  return fetch(`/api/annotations/${bookId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ annotations: bookAnnotations }),
  }).then((r) => {
    if (!r.ok) throw new Error(`annotation sync failed: HTTP ${r.status}`)
    return r.json()
  })
}

function syncBestEffort(bookId: string, annotations: Annotation[]) {
  syncAnnotationsToServer(bookId, annotations).catch(() => {
    // best-effort — optimistic local state + localStorage is the fallback
  })
}

function deleteAnnotationFromServer(bookId: string, annotationId: string) {
  fetch(`/api/annotations/${bookId}/${annotationId}`, { method: 'DELETE' }).catch(() => {
    // fire-and-forget
  })
}

/* ─── The store ───────────────────────────────────────────────────────── */

let all: Annotation[] = loadFromStorage()
const listeners = new Set<() => void>()
const hydratedBooks = new Set<string>()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* quota / private mode — in-memory state still works */
  }
}

// Every mutation goes through here: NEW array reference, mirror, then notify.
function commit(next: Annotation[]) {
  all = next
  persist()
  listeners.forEach((l) => l())
}

// Merge incoming server annotations into local — server wins on id conflict (matches the
// old GET-merge). Used by hydrate() and (step 4) applyRemote().
function mergeServerWins(incoming: Annotation[]) {
  if (incoming.length === 0) return
  const merged = new Map<string, Annotation>()
  for (const a of all) merged.set(a.id, a)
  for (const a of incoming) merged.set(a.id, a)
  commit(Array.from(merged.values()))
}

export const annotationStore = {
  getSnapshot: (): Annotation[] => all,

  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },

  /** Optimistic add + best-effort server write. Returns the new id. */
  add(annotation: Omit<Annotation, 'id' | 'createdAt'>): string {
    const newA = { ...annotation, id: crypto.randomUUID(), createdAt: new Date().toISOString() } as Annotation
    commit([...all, newA])
    if (newA.bookId) syncBestEffort(newA.bookId, all)
    return newA.id
  },

  /** Optimistic add + AWAITED server write; rolls back the marker if the write fails. */
  async addSynced(annotation: Omit<Annotation, 'id' | 'createdAt'>): Promise<string> {
    const newA = { ...annotation, id: crypto.randomUUID(), createdAt: new Date().toISOString() } as Annotation
    commit([...all, newA])
    if (!newA.bookId) return newA.id
    try {
      await syncAnnotationsToServer(newA.bookId, all)
      return newA.id
    } catch (err) {
      commit(all.filter((a) => a.id !== newA.id)) // server never persisted it — roll back
      throw err
    }
  },

  update(id: string, updates: Partial<Omit<Annotation, 'id' | 'type' | 'createdAt'>>) {
    const target = all.find((a) => a.id === id)
    commit(all.map((a) => (a.id === id ? ({ ...a, ...updates } as Annotation) : a)))
    if (target?.bookId) syncBestEffort(target.bookId, all)
  },

  remove(id: string) {
    const target = all.find((a) => a.id === id)
    commit(all.filter((a) => a.id !== id))
    if (target?.bookId) {
      deleteAnnotationFromServer(target.bookId, id)
      syncBestEffort(target.bookId, all)
    }
  },

  /** One-time server hydrate per book (server wins on conflict). */
  hydrate(bookId: string) {
    if (hydratedBooks.has(bookId)) return
    hydratedBooks.add(bookId)
    fetch(`/api/annotations/${bookId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { annotations: Annotation[] }) => {
        mergeServerWins(Array.isArray(data.annotations) ? data.annotations : [])
      })
      .catch(() => {
        hydratedBooks.delete(bookId) // allow a retry on next mount if the server was down
      })
  },

  /** Authoritative local wipe — empties the store (and its localStorage mirror) and lets
   *  books re-hydrate from the server on next mount. Used by PreferencesPanel "Clear data". */
  clearAll() {
    hydratedBooks.clear()
    commit([])
  },

  /** (step 4) Apply a cross-device WS update (server wins). */
  applyRemote(annotations: Annotation[]) {
    mergeServerWins(annotations)
  },
  applyRemoteDelete(id: string) {
    if (all.some((a) => a.id === id)) commit(all.filter((a) => a.id !== id))
  },
}
