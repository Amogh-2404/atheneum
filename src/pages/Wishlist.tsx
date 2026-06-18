import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Sparkles, Plus, X, Clock, Loader2, Check, Minus, Paperclip, Camera, FileText, File as FileIcon } from 'lucide-react'
import { spring, tween } from '@/lib/motion'
import { fetchJSON, postJSON, postForm, apiUrl } from '@/lib/api'

interface Attachment {
  id: string
  name: string
  storedName: string
  mime: string
  size: number
  kind: 'image' | 'pdf' | 'text' | 'archive'
  width?: number
  height?: number
  thumb?: string
  normalizedFrom?: 'heic'
  createdAt: string
}

interface Wish {
  id: string
  text: string
  status: 'pending' | 'in-progress' | 'done' | 'skipped'
  note?: string
  attachments?: Attachment[]
  createdAt: string
  updatedAt?: string
}

const STATUS: Record<Wish['status'], { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Queued', color: 'var(--ink-faint)', icon: <Clock size={12} strokeWidth={2.2} /> },
  'in-progress': { label: 'Working on it', color: 'var(--accent)', icon: <Loader2 size={12} strokeWidth={2.2} /> },
  done: { label: 'Done', color: '#5E8E6E', icon: <Check size={12} strokeWidth={2.6} /> },
  skipped: { label: 'Set aside', color: 'var(--ink-faint)', icon: <Minus size={12} strokeWidth={2.2} /> },
}

const ACCEPT = 'image/*,application/pdf,text/plain,.txt,.md,.zip,.heic,.heif'

export default function Wishlist() {
  const [wishes, setWishes] = useState<Wish[]>([])
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [staged, setStaged] = useState<File[]>([])
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const objectUrls = useRef<Map<File, string>>(new Map())

  const load = useCallback(() => {
    fetchJSON<{ wishes: Wish[] }>('/wishlist').then((d) => setWishes(d.wishes || [])).catch(() => setWishes([]))
  }, [])
  useEffect(() => { load() }, [load])
  // Revoke any object URLs on unmount.
  useEffect(() => () => { objectUrls.current.forEach((u) => URL.revokeObjectURL(u)) }, [])

  const urlFor = (f: File) => {
    let u = objectUrls.current.get(f)
    if (!u) { u = URL.createObjectURL(f); objectUrls.current.set(f, u) }
    return u
  }
  const addStaged = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setStaged((s) => [...s, ...Array.from(files)].slice(0, 12))
  }
  const removeStaged = (f: File) => {
    const u = objectUrls.current.get(f)
    if (u) { URL.revokeObjectURL(u); objectUrls.current.delete(f) }
    setStaged((s) => s.filter((x) => x !== f))
  }
  const clearStaged = () => {
    objectUrls.current.forEach((u) => URL.revokeObjectURL(u))
    objectUrls.current.clear()
    setStaged([])
  }

  const add = useCallback(async () => {
    const t = text.trim()
    if (!t || saving) return // server requires text; attachments ride along with it
    setSaving(true)
    setNotice(null)
    try {
      const { wish } = await postJSON<{ wish: Wish }>('/wishlist', { text: t })
      let finalWish = wish
      if (staged.length > 0) {
        const form = new FormData()
        staged.forEach((f) => form.append('files', f))
        setUploadPct(0)
        try {
          const res = await postForm<{ wish: Wish; added: Attachment[]; rejected: { name: string; reason: string }[] }>(
            `/wishlist/${wish.id}/attachments`, form, setUploadPct,
          )
          finalWish = res.wish
          if (res.rejected?.length) {
            setNotice(`${res.rejected.length} file${res.rejected.length > 1 ? 's' : ''} skipped — ${res.rejected.map((r) => r.reason).join('; ')}`)
          }
        } catch {
          setNotice('Wish saved, but the attachments failed to upload — try re-adding them.')
        } finally { setUploadPct(null) }
      }
      setWishes((w) => [finalWish, ...w])
      setText('')
      clearStaged()
    } catch {
      /* keep the text so sir can retry */
    } finally { setSaving(false) }
  }, [text, saving, staged])

  const remove = useCallback(async (id: string) => {
    setWishes((w) => w.filter((x) => x.id !== id))
    await fetch(apiUrl(`/wishlist/${id}`), { method: 'DELETE' }).catch(() => {})
  }, [])

  const removeAttachment = useCallback(async (wishId: string, attId: string) => {
    setWishes((ws) => ws.map((w) => (w.id === wishId ? { ...w, attachments: w.attachments?.filter((a) => a.id !== attId) } : w)))
    await fetch(apiUrl(`/wishlist/${wishId}/attachments/${attId}`), { method: 'DELETE' }).catch(() => {})
  }, [])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-bg)', padding: 'var(--space-6) var(--space-5) var(--space-8)' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, fontFamily: 'var(--font-ui)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-faint)', textDecoration: 'none' }}>
          <ArrowLeft size={13} strokeWidth={2.2} /> The library
        </Link>
        <header style={{ marginTop: 'var(--space-2)', marginBottom: 'var(--space-5)', paddingBottom: 'var(--space-4)', borderBottom: 'var(--hairline)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-ui)', fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>
            <Sparkles size={12} strokeWidth={2.2} /> Wishlist
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2.3rem', fontWeight: 700, color: 'var(--ink-primary)', margin: 0, lineHeight: 1.1, letterSpacing: '-0.01em' }}>
            Tell me what to build
          </h1>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--ink-secondary)', margin: 'var(--space-2) 0 0', lineHeight: 1.55, maxWidth: '52ch' }}>
            Drop anything here — a feature, a diagram, a deep-dive, a theme, a fix. Attach a screenshot or sketch if it helps. I pick these up overnight and during office hours (9&ndash;12).
          </p>
        </header>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addStaged(e.dataTransfer.files) }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', padding: dragging ? 'var(--space-3)' : 0, border: dragging ? '2px dashed var(--accent)' : '2px dashed transparent', borderRadius: 'var(--radius-3)', transition: 'border-color 120ms, padding 120ms' }}
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') add() }}
            placeholder="e.g. A scrollytelling figure for how SSA construction works, or a dark-mode special edition for the holidays…"
            rows={3}
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'var(--font-body)', fontSize: '16px', lineHeight: 1.55, color: 'var(--ink-primary)', background: 'var(--surface-raised)', border: 'var(--hairline)', borderRadius: 'var(--radius-2)', padding: 'var(--space-3) var(--space-4)', outline: 'none' }}
          />

          {/* hidden inputs: file picker + camera capture */}
          <input ref={fileInput} type="file" multiple accept={ACCEPT} style={{ display: 'none' }}
            onChange={(e) => { addStaged(e.target.files); e.target.value = '' }} />
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
            onChange={(e) => { addStaged(e.target.files); e.target.value = '' }} />

          {/* staged thumbnails */}
          {staged.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 2 }}>
              {staged.map((f, i) => (
                <div key={i} style={{ position: 'relative', width: 64, height: 64, borderRadius: 'var(--radius-2)', overflow: 'hidden', border: 'var(--hairline)', background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {f.type.startsWith('image/') || /\.hei[cf]$/i.test(f.name)
                    ? <img src={urlFor(f)} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <FileChipIcon name={f.name} />}
                  <button type="button" onClick={() => removeStaged(f)} aria-label="Remove"
                    style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 'var(--radius-full)', background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: 'pointer' }}>
                    <X size={12} strokeWidth={2.6} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* upload progress */}
          {uploadPct != null && (
            <div style={{ height: 2, background: 'var(--hairline-color, rgba(0,0,0,0.08))', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.round(uploadPct * 100)}%`, background: 'var(--accent)', transition: 'width 120ms' }} />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <IconButton onClick={() => fileInput.current?.click()} title="Attach files"><Paperclip size={15} strokeWidth={2.2} /></IconButton>
            <IconButton onClick={() => cameraInput.current?.click()} title="Take a photo"><Camera size={15} strokeWidth={2.2} /></IconButton>
            <div style={{ flex: 1 }} />
            <motion.button
              type="button" onClick={add} disabled={!text.trim() || saving} whileTap={{ scale: 0.97 }} transition={spring.press}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 44, padding: '0 18px', fontFamily: 'var(--font-ui)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--paper-bg)', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-2)', cursor: text.trim() ? 'pointer' : 'not-allowed', opacity: text.trim() && !saving ? 1 : 0.5 }}
            >
              {saving ? <Loader2 size={16} strokeWidth={2.4} className="spin" /> : <Plus size={16} strokeWidth={2.4} />} Add to wishlist
            </motion.button>
          </div>
          {notice && (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.74rem', color: 'var(--ink-secondary)', lineHeight: 1.45 }}>{notice}</div>
          )}
        </div>

        {wishes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-7) 0', fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--ink-faint)' }}>
            Nothing on the list yet. What should Atheneum become?
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <AnimatePresence initial={false}>
              {wishes.map((w) => {
                const s = STATUS[w.status]
                return (
                  <motion.div
                    key={w.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={tween.enter}
                    style={{ padding: 'var(--space-4)', borderRadius: 'var(--radius-3)', border: 'var(--hairline)', background: 'var(--surface-raised)', boxShadow: 'var(--shadow-1)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--ink-primary)', lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{w.text}</div>
                        {w.note && (
                          <div style={{ marginTop: 'var(--space-2)', fontFamily: 'var(--font-body)', fontSize: '0.88rem', fontStyle: 'italic', color: 'var(--ink-secondary)', lineHeight: 1.5 }}>
                            {w.note}
                          </div>
                        )}
                        {w.attachments && w.attachments.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                            {w.attachments.map((a) => (
                              <AttachmentChip key={a.id} wishId={w.id} att={a} onRemove={() => removeAttachment(w.id, a.id)} />
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 'var(--space-3)', fontFamily: 'var(--font-ui)', fontSize: '0.66rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: s.color }}>
                          {s.icon} {s.label}
                        </div>
                      </div>
                      <button type="button" onClick={() => remove(w.id)} aria-label="Remove" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: 'none', borderRadius: 'var(--radius-full)', background: 'transparent', color: 'var(--ink-faint)', cursor: 'pointer' }}>
                        <X size={15} strokeWidth={2} />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}

function IconButton({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, border: 'var(--hairline)', borderRadius: 'var(--radius-2)', background: 'var(--surface-raised)', color: 'var(--ink-secondary)', cursor: 'pointer' }}>
      {children}
    </button>
  )
}

function FileChipIcon({ name }: { name: string }) {
  const isText = /\.(txt|md)$/i.test(name)
  return isText
    ? <FileText size={22} strokeWidth={1.8} color="var(--ink-faint)" />
    : <FileIcon size={22} strokeWidth={1.8} color="var(--ink-faint)" />
}

function AttachmentChip({ wishId, att, onRemove }: { wishId: string; att: Attachment; onRemove: () => void }) {
  const href = apiUrl(`/wishlist/${wishId}/attachments/${att.id}`)
  return (
    <div style={{ position: 'relative', width: 56, height: 56, borderRadius: 'var(--radius-2)', overflow: 'hidden', border: 'var(--hairline)', background: 'var(--surface-raised)' }}>
      <a href={href} target="_blank" rel="noreferrer" title={att.name}
        style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
        {att.kind === 'image' && att.thumb
          ? <img src={apiUrl(`/wishlist/${wishId}/attachments/${att.id}/thumb`)} alt={att.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <FileChipIcon name={att.name} />}
      </a>
      <button type="button" onClick={onRemove} aria-label="Remove attachment"
        style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 'var(--radius-full)', background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: 'pointer' }}>
        <X size={11} strokeWidth={2.6} />
      </button>
    </div>
  )
}
