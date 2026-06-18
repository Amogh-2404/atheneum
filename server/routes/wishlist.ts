import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { readFileSync, existsSync, mkdirSync, createReadStream } from 'fs'
import { Readable } from 'node:stream'
import path from 'path'
import { fileURLToPath } from 'url'
import { atomicWriteJSON } from '../lib/write-gate.js'
import { withFileLock } from '../git.js'
import {
  storeAttachment, deleteAttachmentFiles, deleteWishAttachmentDir, resolveInWishDir, isValidWishId,
  MAX_TOTAL_BYTES, MAX_FILES_PER_WISH, type Attachment, type RejectedFile,
} from '../lib/attachments.js'

// Sir's wishlist inbox: anything he wants Atheneum to become — a feature, a diagram,
// a deep-dive, a theme, with optional file attachments (screenshots, sketches, PDFs)
// uploaded from his phone. The morning/overnight daemons pull from here. Stored in
// the ACO state dir so the daemon and the server share one file.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.join(__dirname, '..', '..', '.aco', 'wishlist.json')

export interface Wish {
  id: string
  text: string
  status: 'pending' | 'in-progress' | 'done' | 'skipped'
  note?: string
  attachments?: Attachment[]
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

function writeWishes(wishes: Wish[]): void {
  mkdirSync(path.dirname(FILE), { recursive: true })
  atomicWriteJSON(FILE, wishes) // atomic temp+rename; .aco is gitignored so no git-lock
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
  // Lock the read-modify-write: the whole array is rewritten, so an unguarded concurrent
  // mutation would clobber wishes (even unrelated ones). Read INSIDE the lock.
  await withFileLock(FILE, async () => writeWishes([wish, ...readWishes()]))
  return c.json({ wish }, 201)
})

// ─── Attachments (children of /api/wishlist — no index.ts change needed) ─────────
// Registered BEFORE the bare DELETE /:id so the longer paths always resolve first.

// POST /:id/attachments — multipart upload (field `files`, repeatable)
wishlistRouter.post(
  '/:id/attachments',
  bodyLimit({ maxSize: MAX_TOTAL_BYTES, onError: (c) => c.json({ error: 'request too large' }, 413) }),
  async (c) => {
    const id = c.req.param('id')
    if (!isValidWishId(id)) return c.json({ error: 'bad id' }, 400)

    const parsed = await c.req.parseBody({ all: true }).catch(() => null)
    if (!parsed) return c.json({ error: 'invalid form' }, 400)
    const raw = parsed['files']
    const files = (Array.isArray(raw) ? raw : [raw]).filter((x): x is File => x instanceof File)
    if (files.length === 0) return c.json({ error: 'no files' }, 400)

    // Buffer the uploaded bytes BEFORE taking the lock (don't hold it during network read).
    const bufs: { name: string; buf: Buffer }[] = []
    for (const f of files) bufs.push({ name: f.name, buf: Buffer.from(await f.arrayBuffer()) })

    let notFound = false
    let out: { wish: Wish; added: Attachment[]; rejected: RejectedFile[] } | null = null
    // Lock the whole find→store→append→write span so concurrent uploads can't lose each
    // other's metadata (which would orphan the stored files). Read INSIDE the lock.
    await withFileLock(FILE, async () => {
      const wishes = readWishes()
      const wish = wishes.find((w) => w.id === id)
      if (!wish) { notFound = true; return }
      const added: Attachment[] = []
      const rejected: RejectedFile[] = []
      const already = wish.attachments?.length ?? 0
      for (const { name, buf } of bufs) {
        if (already + added.length >= MAX_FILES_PER_WISH) {
          rejected.push({ name, reason: `max ${MAX_FILES_PER_WISH} attachments per wish` })
          continue
        }
        const r = storeAttachment(id, name, buf)
        if (r.ok) added.push(r.att)
        else rejected.push(r.rejected)
      }
      if (added.length > 0) {
        wish.attachments = [...(wish.attachments ?? []), ...added]
        wish.updatedAt = new Date().toISOString()
        writeWishes(wishes)
      }
      out = { wish, added, rejected }
    })

    if (notFound) return c.json({ error: 'wish not found' }, 404)
    if (!out) return c.json({ error: 'upload failed' }, 500)
    const r = out as { wish: Wish; added: Attachment[]; rejected: RejectedFile[] }
    if (r.added.length === 0) return c.json({ error: 'all files rejected', rejected: r.rejected }, 415)
    return c.json({ wish: r.wish, added: r.added, rejected: r.rejected }, 201)
  },
)

// GET /:id/attachments/:attId/thumb — small JPEG thumb (images only)
wishlistRouter.get('/:id/attachments/:attId/thumb', (c) => {
  const id = c.req.param('id')
  if (!isValidWishId(id)) return c.json({ error: 'bad id' }, 400)
  const att = readWishes().find((w) => w.id === id)?.attachments?.find((a) => a.id === c.req.param('attId'))
  if (!att?.thumb) return c.json({ error: 'no thumb' }, 404)
  const abs = resolveInWishDir(id, att.thumb)
  if (!abs || !existsSync(abs)) return c.json({ error: 'no thumb' }, 404)
  c.header('Content-Type', 'image/jpeg')
  c.header('Cache-Control', 'private, max-age=31536000, immutable')
  return c.body(Readable.toWeb(createReadStream(abs)) as unknown as ReadableStream)
})

// GET /:id/attachments/:attId — stream the stored file inline
wishlistRouter.get('/:id/attachments/:attId', (c) => {
  const id = c.req.param('id')
  if (!isValidWishId(id)) return c.json({ error: 'bad id' }, 400)
  // wishlist.json is the authority on what belongs to the wish — not the filesystem.
  const att = readWishes().find((w) => w.id === id)?.attachments?.find((a) => a.id === c.req.param('attId'))
  if (!att) return c.json({ error: 'not found' }, 404)
  const abs = resolveInWishDir(id, att.storedName)
  if (!abs || !existsSync(abs)) return c.json({ error: 'not found' }, 404)
  c.header('Content-Type', att.mime)
  c.header('Content-Length', String(att.size))
  c.header('Content-Disposition', `inline; filename="${att.name.replace(/["\r\n]/g, '')}"`)
  c.header('Cache-Control', 'private, max-age=31536000, immutable')
  c.header('X-Content-Type-Options', 'nosniff')
  return c.body(Readable.toWeb(createReadStream(abs)) as unknown as ReadableStream)
})

// DELETE /:id/attachments/:attId — remove one attachment (files + metadata)
wishlistRouter.delete('/:id/attachments/:attId', async (c) => {
  const id = c.req.param('id')
  if (!isValidWishId(id)) return c.json({ error: 'bad id' }, 400)
  const attId = c.req.param('attId')
  let notFound = false
  let out: Wish | null = null
  await withFileLock(FILE, async () => {
    const wishes = readWishes()
    const wish = wishes.find((w) => w.id === id)
    const att = wish?.attachments?.find((a) => a.id === attId)
    if (!wish || !att) { notFound = true; return }
    deleteAttachmentFiles(id, att)
    wish.attachments = wish.attachments!.filter((a) => a.id !== att.id)
    wish.updatedAt = new Date().toISOString()
    writeWishes(wishes)
    out = wish
  })
  if (notFound) return c.json({ error: 'not found' }, 404)
  return c.json({ ok: true, wish: out })
})

// DELETE /:id — remove the wish AND its uploaded files
wishlistRouter.delete('/:id', async (c) => {
  const id = c.req.param('id')
  deleteWishAttachmentDir(id)
  await withFileLock(FILE, async () => writeWishes(readWishes().filter((w) => w.id !== id)))
  return c.json({ ok: true })
})
