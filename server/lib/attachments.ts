// Wishlist attachment handling: validate → (HEIC→JPEG normalize) → store → thumbnail.
// Single-user + Tailscale-only, but treated with real rigor anyway: filename sanitization
// (no traversal), an ext+MIME+magic-byte allowlist that all must agree, and a hard
// executable reject. Files live under .aco/attachments/<wishId>/ (gitignored).
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync, rmSync, statSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ATTACH_DIR = path.join(__dirname, '..', '..', '.aco', 'attachments')

export const MAX_FILE_BYTES = 25 * 1024 * 1024   // 25 MB / file (phone photos, PDFs)
export const MAX_TOTAL_BYTES = 60 * 1024 * 1024  // 60 MB / request (bodyLimit)
export const MAX_FILES_PER_WISH = 12

export type AttachmentKind = 'image' | 'pdf' | 'text' | 'archive'

export interface Attachment {
  id: string
  name: string          // original filename (display)
  storedName: string    // on-disk basename (served + read by the daemon)
  mime: string          // canonical mime (post-normalization)
  size: number
  kind: AttachmentKind
  width?: number
  height?: number
  thumb?: string        // thumb basename, images only
  normalizedFrom?: 'heic'
  createdAt: string
}

// ext → [canonical mime, kind]. The browser-supplied mime is advisory (Safari sends
// application/octet-stream for HEIC); the EXTENSION drives, magic bytes confirm.
const ALLOW: Record<string, { mime: string; kind: AttachmentKind }> = {
  '.jpg':  { mime: 'image/jpeg', kind: 'image' },
  '.jpeg': { mime: 'image/jpeg', kind: 'image' },
  '.png':  { mime: 'image/png',  kind: 'image' },
  '.webp': { mime: 'image/webp', kind: 'image' },
  '.gif':  { mime: 'image/gif',  kind: 'image' },
  '.heic': { mime: 'image/heic', kind: 'image' },
  '.heif': { mime: 'image/heif', kind: 'image' },
  '.pdf':  { mime: 'application/pdf', kind: 'pdf' },
  '.txt':  { mime: 'text/plain', kind: 'text' },
  '.md':   { mime: 'text/markdown', kind: 'text' },
  '.zip':  { mime: 'application/zip', kind: 'archive' },
}

/** Sniff the leading bytes. Returns a coarse content family or 'exec'/'unknown'. */
function sniff(buf: Buffer): 'jpeg' | 'png' | 'gif' | 'webp' | 'pdf' | 'zip' | 'heic' | 'text' | 'exec' | 'unknown' {
  if (buf.length < 4) return 'unknown'
  const b = buf
  // Executables — hard reject regardless of extension.
  if (b[0] === 0x4d && b[1] === 0x5a) return 'exec'                               // MZ (PE)
  if (b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46) return 'exec' // ELF
  if (b[0] === 0x23 && b[1] === 0x21) return 'exec'                               // #! shebang
  const m4 = b.readUInt32BE(0)
  if ([0xfeedface, 0xcefaedfe, 0xfeedfacf, 0xcffaedfe, 0xcafebabe].includes(m4)) return 'exec' // Mach-O / fat
  // Content types.
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'gif'
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf'
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)) return 'zip'
  if (b.length >= 12 && b.toString('ascii', 4, 8) === 'ftyp') {
    const brand = b.toString('ascii', 8, 12)
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'].includes(brand)) return 'heic'
  }
  return 'unknown'
}

// Which sniffed families are acceptable for a given ext (magic must corroborate ext).
const EXT_OK_SNIFF: Record<string, string[]> = {
  '.jpg': ['jpeg'], '.jpeg': ['jpeg'], '.png': ['png'], '.webp': ['webp'], '.gif': ['gif'],
  '.heic': ['heic'], '.heif': ['heic'],
  '.pdf': ['pdf'], '.zip': ['zip'],
  '.txt': ['text', 'unknown'], '.md': ['text', 'unknown'],   // text has no fixed magic
}

function safeBase(name: string): string {
  const base = path.basename(name)                          // strip any path components
  const stem = base.slice(0, base.length - path.extname(base).length)
  const cleaned = stem.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase().slice(0, 48)
  return cleaned || 'file'
}

const WISH_ID_RE = /^w_[a-z0-9_]+$/i

export function isValidWishId(id: string): boolean {
  return WISH_ID_RE.test(id)
}

/** Resolve a path inside a wish's attachment dir, asserting no traversal escaped. */
export function resolveInWishDir(wishId: string, name: string): string | null {
  if (!isValidWishId(wishId)) return null
  const dir = path.join(ATTACH_DIR, wishId)
  // basename() is the real traversal guard — it collapses ../../x and /etc/x to a bare
  // leaf. The startsWith() containment check below is the backstop.
  const target = path.resolve(dir, path.basename(name))
  if (!target.startsWith(path.resolve(dir) + path.sep)) return null
  return target
}

export interface RejectedFile { name: string; reason: string }
export type StoreResult = { ok: true; att: Attachment } | { ok: false; rejected: RejectedFile }

/** Validate + persist one uploaded file. Pure of HTTP — caller does counts/caps/JSON. */
export function storeAttachment(wishId: string, originalName: string, buf: Buffer): StoreResult {
  const reject = (reason: string): StoreResult => ({ ok: false, rejected: { name: originalName, reason } })
  if (!isValidWishId(wishId)) return reject('bad wish id')
  if (buf.length === 0) return reject('empty file')
  if (buf.length > MAX_FILE_BYTES) return reject(`too large (max ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB)`)

  const ext = path.extname(originalName).toLowerCase()
  const allow = ALLOW[ext]
  if (!allow) return reject(`type ${ext || '(none)'} not allowed`)

  const kind = sniff(buf)
  if (kind === 'exec') return reject('executable rejected')
  const okSniffs = EXT_OK_SNIFF[ext] ?? []
  if (!okSniffs.includes(kind)) return reject(`content does not match ${ext}`)

  const id = 'a_' + Date.now().toString(36) + '_' + randomBytes(3).toString('hex')
  const base = safeBase(originalName)
  const dir = path.join(ATTACH_DIR, wishId)

  try {
    mkdirSync(dir, { recursive: true })

    let storedName: string
    let mime = allow.mime
    let normalizedFrom: 'heic' | undefined

    if (kind === 'heic') {
      // Keep the untouched original (provenance, never served), produce a JPEG the UI
      // and the daemon can always render. If sips can't convert it (a spoofed or odd
      // HEIC that passed the magic sniff), reject cleanly — never let the request 500
      // on a statSync of a JPEG that was never produced.
      const origAbs = path.join(dir, `${id}__${base}.heic.orig`)
      writeFileSync(origAbs, buf)
      storedName = `${id}__${base}.jpg`
      const storedAbs = path.join(dir, storedName)
      if (!sips(['-s', 'format', 'jpeg', '--out', storedAbs, origAbs]) || !existsSync(storedAbs)) {
        rmSync(origAbs, { force: true })
        return reject('HEIC could not be converted')
      }
      mime = 'image/jpeg'
      normalizedFrom = 'heic'
    } else {
      storedName = `${id}__${base}${ext}`
      writeFileSync(path.join(dir, storedName), buf)
    }

    const att: Attachment = {
      id, name: path.basename(originalName).slice(0, 200), storedName, mime,
      size: statSync(path.join(dir, storedName)).size, kind: allow.kind,
      normalizedFrom, createdAt: new Date().toISOString(),
    }

    // Image extras: dimensions + a small JPEG thumb for the wishlist cards.
    if (allow.kind === 'image') {
      const stored = path.join(dir, storedName)
      const dims = sipsDims(stored)
      if (dims) { att.width = dims.w; att.height = dims.h }
      const thumbName = `${id}.thumb.jpg`
      if (sips(['-Z', '480', '-s', 'format', 'jpeg', '--out', path.join(dir, thumbName), stored])) {
        att.thumb = thumbName
      }
    }
    return { ok: true, att }
  } catch (err) {
    // Any fs/sips surprise becomes a clean rejection (415), never a 500. Best-effort
    // sweep of this attachment's partial files.
    try { for (const f of readdirSync(dir)) if (f.startsWith(id)) rmSync(path.join(dir, f), { force: true }) } catch { /* ignore */ }
    return reject(`store failed: ${(err as Error).message}`)
  }
}

/** Run sips with an args array (never shell-interpolated). Returns true on success.
 *  Bounded by a timeout so a pathological image can't hang the single-threaded server. */
function sips(args: string[]): boolean {
  try { execFileSync('/usr/bin/sips', args, { stdio: 'ignore', timeout: 15000, killSignal: 'SIGKILL' }); return true }
  catch { return false }
}

function sipsDims(file: string): { w: number; h: number } | null {
  try {
    const out = execFileSync('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf-8', timeout: 10000, killSignal: 'SIGKILL' })
    const w = /pixelWidth:\s*(\d+)/.exec(out)?.[1]
    const h = /pixelHeight:\s*(\d+)/.exec(out)?.[1]
    return w && h ? { w: Number(w), h: Number(h) } : null
  } catch { return null }
}

/** Remove an attachment's stored file + its .orig + its thumb. */
export function deleteAttachmentFiles(wishId: string, att: Attachment): void {
  const dir = path.join(ATTACH_DIR, wishId)
  for (const f of [att.storedName, att.thumb, att.normalizedFrom === 'heic' ? att.storedName.replace(/\.jpg$/, '.heic.orig') : undefined]) {
    if (!f) continue
    const p = path.join(dir, f)
    try { if (existsSync(p)) rmSync(p) } catch { /* best effort */ }
  }
}

/** Remove a wish's entire attachment dir (on wish delete). */
export function deleteWishAttachmentDir(wishId: string): void {
  if (!isValidWishId(wishId)) return
  try { rmSync(path.join(ATTACH_DIR, wishId), { recursive: true, force: true }) } catch { /* best effort */ }
}
