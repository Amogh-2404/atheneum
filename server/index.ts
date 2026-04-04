import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import path from 'path'
import { fileURLToPath } from 'url'
import { booksRouter } from './routes/books.js'
import { chaptersRouter } from './routes/chapters.js'
import { ConnectionManager } from './ws.js'
import { startWatcher } from './watcher.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const CONTENT_DIR = path.join(__dirname, '..', 'content')

const app = new Hono()

// ─── Middleware ────────────────────────────────────────────────────
app.use('*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3100'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}))

// ─── API Routes ───────────────────────────────────────────────────
app.route('/api/books', booksRouter)

// Mount chapters under books/:bookId/chapters
app.route('/api/books/:bookId/chapters', chaptersRouter)

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
  console.log(`The Codex server running on http://0.0.0.0:${info.port}`)
})

// Attach WebSocket server and file watcher to the HTTP server
cm = new ConnectionManager(server)
startWatcher(CONTENT_DIR, cm)
