import { Hono } from 'hono'
import { readFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { atomicWriteJSON } from '../lib/write-gate.js'

// Sir's wishlist inbox: anything he wants Atheneum to become — a feature, a diagram,
// a deep-dive, a theme. The morning (office-hours) daemon pulls from here. Stored in
// the ACO state dir so the daemon and the server share one file.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.join(__dirname, '..', '..', '.aco', 'wishlist.json')

export interface Wish {
  id: string
  text: string
  status: 'pending' | 'in-progress' | 'done' | 'skipped'
  note?: string
  createdAt: string
  updatedAt?: string
}

function readWishes(): Wish[] {
  try {
    if (!existsSync(FILE)) return []
    const parsed = JSON.parse(readFileSync(FILE, 'utf-8'))
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export const wishlistRouter = new Hono()

wishlistRouter.get('/', (c) => c.json({ wishes: readWishes() }))

wishlistRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (!text) return c.json({ error: 'text required' }, 400)
  const wish: Wish = {
    id: `w_${Date.now().toString(36)}_${Math.floor(performance.now()).toString(36)}`,
    text: text.slice(0, 4000),
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  mkdirSync(path.dirname(FILE), { recursive: true })
  atomicWriteJSON(FILE, [wish, ...readWishes()]) // atomic temp+rename; .aco is gitignored so no git-lock
  return c.json({ wish }, 201)
})

wishlistRouter.delete('/:id', (c) => {
  const id = c.req.param('id')
  mkdirSync(path.dirname(FILE), { recursive: true })
  atomicWriteJSON(FILE, readWishes().filter((w) => w.id !== id))
  return c.json({ ok: true })
})
