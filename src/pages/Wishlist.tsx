import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Sparkles, Plus, X, Clock, Loader2, Check, Minus } from 'lucide-react'
import { spring, tween } from '@/lib/motion'
import { fetchJSON, postJSON } from '@/lib/api'

interface Wish {
  id: string
  text: string
  status: 'pending' | 'in-progress' | 'done' | 'skipped'
  note?: string
  createdAt: string
  updatedAt?: string
}

const STATUS: Record<Wish['status'], { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Queued', color: 'var(--ink-faint)', icon: <Clock size={12} strokeWidth={2.2} /> },
  'in-progress': { label: 'Working on it', color: 'var(--accent)', icon: <Loader2 size={12} strokeWidth={2.2} /> },
  done: { label: 'Done', color: '#5E8E6E', icon: <Check size={12} strokeWidth={2.6} /> },
  skipped: { label: 'Set aside', color: 'var(--ink-faint)', icon: <Minus size={12} strokeWidth={2.2} /> },
}

export default function Wishlist() {
  const [wishes, setWishes] = useState<Wish[]>([])
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    fetchJSON<{ wishes: Wish[] }>('/wishlist').then((d) => setWishes(d.wishes || [])).catch(() => setWishes([]))
  }, [])
  useEffect(() => { load() }, [load])

  const add = useCallback(async () => {
    const t = text.trim()
    if (!t || saving) return
    setSaving(true)
    try {
      const { wish } = await postJSON<{ wish: Wish }>('/wishlist', { text: t })
      setWishes((w) => [wish, ...w])
      setText('')
    } catch { /* swallow — keep the text so sir can retry */ } finally { setSaving(false) }
  }, [text, saving])

  const remove = useCallback(async (id: string) => {
    setWishes((w) => w.filter((x) => x.id !== id))
    await fetch(`/api/wishlist/${id}`, { method: 'DELETE' }).catch(() => {})
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
            Drop anything here — a feature, a diagram, a deep-dive, a theme, a fix. I pick these up during office hours (9&ndash;12) and work through them; overnight I keep the library itself fresh.
          </p>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') add() }}
            placeholder="e.g. A scrollytelling figure for how SSA construction works, or a dark-mode special edition for the holidays…"
            rows={3}
            style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'var(--font-body)', fontSize: '16px', lineHeight: 1.55, color: 'var(--ink-primary)', background: 'var(--surface-raised)', border: 'var(--hairline)', borderRadius: 'var(--radius-2)', padding: 'var(--space-3) var(--space-4)', outline: 'none' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <motion.button
              type="button" onClick={add} disabled={!text.trim() || saving} whileTap={{ scale: 0.97 }} transition={spring.press}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 44, padding: '0 18px', fontFamily: 'var(--font-ui)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--paper-bg)', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-2)', cursor: text.trim() ? 'pointer' : 'not-allowed', opacity: text.trim() && !saving ? 1 : 0.5 }}
            >
              <Plus size={16} strokeWidth={2.4} /> Add to wishlist
            </motion.button>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '0.72rem', color: 'var(--ink-faint)' }}>⌘↵ to add</span>
          </div>
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
