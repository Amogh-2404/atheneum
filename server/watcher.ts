import chokidar from 'chokidar'
import { readFileSync } from 'fs'
import path from 'path'
import type { ConnectionManager } from './ws.js'
import { scheduleCommit } from './git.js'

export function startWatcher(contentDir: string, cm: ConnectionManager) {
  const watcher = chokidar.watch(contentDir, {
    ignoreInitial: true,
    ignored: [
      /(^|[\/\\])\../,     // dotfiles and dot-directories (.git, .state, .annotations)
      /node_modules/,
    ],
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  })

  // Debounce per file path
  const pending = new Map<string, ReturnType<typeof setTimeout>>()

  function handleChange(filePath: string) {
    const existing = pending.get(filePath)
    if (existing) clearTimeout(existing)

    pending.set(filePath, setTimeout(() => {
      pending.delete(filePath)
      processChange(filePath, contentDir, cm)
    }, 300))
  }

  watcher.on('change', handleChange)
  watcher.on('add', handleChange)

  console.log(`[watcher] Watching ${contentDir}`)
}

function processChange(filePath: string, contentDir: string, cm: ConnectionManager) {
  // Only process JSON files
  if (!filePath.endsWith('.json')) return

  const relative = path.relative(contentDir, filePath)
  const parts = relative.split(path.sep)

  let data: any
  try {
    data = JSON.parse(readFileSync(filePath, 'utf-8'))
  } catch (e) {
    console.error(`[watcher] Failed to parse ${relative}:`, (e as Error).message)
    return
  }

  // ─── _index.json ─────────────────────────────────────────────
  if (relative === '_index.json') {
    cm.broadcastAll({
      type: 'index-updated',
      index: data,
    })
    scheduleCommit(contentDir, filePath, 'Update book index')
    console.log(`[watcher] index-updated`)
    return
  }

  // ─── {bookId}/book.json ──────────────────────────────────────
  if (parts.length === 2 && parts[1] === 'book.json') {
    const bookId = parts[0]
    cm.broadcast(bookId, null, {
      type: 'book-updated',
      bookId,
      book: data,
    })
    scheduleCommit(contentDir, filePath, `Update ${bookId} metadata`)
    console.log(`[watcher] book-updated: ${bookId}`)
    return
  }

  // ─── {bookId}/outline.json ───────────────────────────────────
  if (parts.length === 2 && parts[1] === 'outline.json') {
    const bookId = parts[0]
    cm.broadcast(bookId, null, {
      type: 'outline-updated',
      bookId,
      outline: data,
    })
    scheduleCommit(contentDir, filePath, `Update ${bookId} outline`)
    console.log(`[watcher] outline-updated: ${bookId}`)
    return
  }

  // ─── {bookId}/chapters/{chapterId}.json ──────────────────────
  if (parts.length === 3 && parts[1] === 'chapters' && parts[2].endsWith('.json')) {
    const bookId = parts[0]
    const chapterId = parts[2].replace('.json', '')
    cm.broadcast(bookId, chapterId, {
      type: 'chapter-updated',
      bookId,
      chapterId,
      chapter: data,
    })
    scheduleCommit(contentDir, filePath, `Update ${bookId}/${chapterId}`)
    console.log(`[watcher] chapter-updated: ${bookId}/${chapterId}`)
    return
  }

  // ─── Unknown file — still commit it ──────────────────────────
  scheduleCommit(contentDir, filePath, `Update ${relative}`)
  console.log(`[watcher] file changed (unclassified): ${relative}`)
}
