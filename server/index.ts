import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import path from 'path'
import { fileURLToPath } from 'url'
import { booksRouter } from './routes/books.js'
import { chaptersRouter } from './routes/chapters.js'
import { annotationsRouter } from './routes/annotations.js'
import { readingPositionRouter } from './routes/reading-position.js'
import { learningProgressRouter } from './routes/learning-progress.js'
import { struggleRouter } from './routes/struggle.js'
import { draftsRouter } from './routes/drafts.js'
import { historyRouter } from './routes/history.js'
import { wishlistRouter } from './routes/wishlist.js'
import { ConnectionManager } from './ws.js'
import { startWatcher } from './watcher.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const CONTENT_DIR = path.join(__dirname, '..', 'content')

const app = new Hono()

// ─── Middleware ────────────────────────────────────────────────────
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3100'],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
}))

// ─── API Routes ───────────────────────────────────────────────────
app.route('/api/books', booksRouter)

// Sir's wishlist inbox (the morning office-hours daemon fulfils it)
app.route('/api/wishlist', wishlistRouter)

// Mount chapters under books/:bookId/chapters
app.route('/api/books/:bookId/chapters', chaptersRouter)

// Annotations sync (server-side persistence)
app.route('/api/annotations', annotationsRouter)

// Reading position sync (cross-device)
app.route('/api/reading-position', readingPositionRouter)

// Learning progress (quiz scores, flashcard SRS)
app.route('/api/learning-progress', learningProgressRouter)

// Reading telemetry -> per-block struggle score (Forge-facing)
app.route('/api/struggle', struggleRouter)

// Pending ai-improve-loop drafts (Morning Brief)
app.route('/api/drafts', draftsRouter)

// Version history (git-backed)
app.route('/api/books/:bookId/chapters/:chapterId/history', historyRouter)

// ─── Static Content (images, diagrams per book) ───────────────────
// Serve /content/:bookId/images/* and /content/:bookId/diagrams/*
app.use('/content/*', serveStatic({
  root: './',
  rewriteRequestPath: (reqPath) => {
    // /content/some-book/images/fig.png → content/some-book/images/fig.png
    return reqPath.replace(/^\/content/, 'content')
  },
}))

// ─── Health / Status ──────────────────────────────────────────────
let cm: ConnectionManager

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.get('/api/ws-status', (c) => {
  return c.json({ clients: cm?.clientCount ?? 0 })
})

// ─── Production: Serve built frontend from dist/ ─────────────────
import { existsSync, readFileSync } from 'fs'

const distDir = path.join(__dirname, '..', 'dist')
if (existsSync(distDir)) {
  // Serve static assets from dist/
  app.use('/*', serveStatic({ root: './dist' }))
  // SPA fallback: serve index.html for client-side routes
  app.get('*', (c) => {
    const reqPath = c.req.path
    if (reqPath.startsWith('/api/') || reqPath.startsWith('/content/') || reqPath.startsWith('/ws')) {
      return c.json({ error: 'not found' }, 404)
    }
    const indexHtml = path.join(distDir, 'index.html')
    if (existsSync(indexHtml)) {
      return c.html(readFileSync(indexHtml, 'utf-8'))
    }
    return c.json({ error: 'not found' }, 404)
  })
}

// ─── 404 fallback ─────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ error: 'not found' }, 404)
})

// ─── Error handler ────────────────────────────────────────────────
app.onError((err, c) => {
  console.error(`[server] ${err.message}`)
  return c.json({ error: 'internal server error' }, 500)
})

// ─── Start ────────────────────────────────────────────────────────
const PORT = 3100

const server = serve({
  fetch: app.fetch,
  port: PORT,
  hostname: '0.0.0.0',
}, (info) => {
  console.log(`Atheneum server running on http://0.0.0.0:${info.port}`)
})

// Attach WebSocket server and file watcher to the HTTP server
cm = new ConnectionManager(server)
startWatcher(CONTENT_DIR, cm)
