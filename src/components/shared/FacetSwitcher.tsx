import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { spring } from '@/lib/motion'

/**
 * The persistent way between a book's four surfaces. Today they're reachable
 * ONLY from the Reader sidebar; this quiet frosted pill makes Read / Map /
 * Study / Notebook one keystroke apart from anywhere, with a layoutId underline
 * that slides to the active facet. Apparatus, not prose — Rajdhani (--font-ui),
 * chrome-toned, secondary to the content it floats over.
 */
const FACETS = [
  { key: 'reader', label: 'Read', sub: '' },
  { key: 'graph', label: 'Map', sub: 'graph' },
  { key: 'study', label: 'Study', sub: 'study' },
  { key: 'notebook', label: 'Notebook', sub: 'notebook' },
] as const

export function currentFacet(pathname: string): string {
  const seg = pathname.split('/')[3] || ''
  return seg === 'graph' || seg === 'study' || seg === 'notebook' ? seg : 'reader'
}

export default function FacetSwitcher() {
  const navigate = useNavigate()
  const { bookId } = useParams()
  const location = useLocation()
  if (!bookId) return null
  const active = currentFacet(location.pathname)

  return (
    <motion.nav
      aria-label="Book surfaces"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 0.82, y: 0 }}
      whileHover={{ opacity: 1 }}
      transition={spring.default}
      className="glass"
      style={{
        position: 'fixed',
        bottom: 'var(--space-5)',
        left: '50%',
        x: '-50%',
        zIndex: 60,
        display: 'flex',
        gap: 2,
        padding: 'var(--space-1)',
        borderRadius: 'var(--radius-full)',
        background: 'var(--chrome-glass)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
        border: '1px solid var(--chrome-border)',
        boxShadow: 'var(--shadow-3)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {FACETS.map((f) => {
        const isActive = active === f.key
        return (
          <motion.button
            key={f.key}
            type="button"
            whileTap={{ scale: 0.96 }}
            transition={spring.press}
            onClick={() => navigate(`/book/${bookId}${f.sub ? '/' + f.sub : ''}`)}
            aria-current={isActive ? 'page' : undefined}
            style={{
              position: 'relative',
              appearance: 'none',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: '7px 16px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: 'var(--chrome-text)',
              opacity: isActive ? 1 : 0.6,
              transition: 'opacity var(--duration-fast) var(--ease-standard)',
            }}
          >
            {f.label}
            {isActive && (
              <motion.span
                layoutId="facet-underline"
                transition={spring.layout}
                style={{
                  position: 'absolute',
                  left: 14,
                  right: 14,
                  bottom: 3,
                  height: 2,
                  borderRadius: 2,
                  background: 'var(--chrome-accent)',
                }}
              />
            )}
          </motion.button>
        )
      })}
    </motion.nav>
  )
}
