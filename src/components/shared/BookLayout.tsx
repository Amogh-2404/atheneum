import { Outlet, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { tween } from '@/lib/motion'
import FacetSwitcher, { currentFacet } from '@/components/shared/FacetSwitcher'

/**
 * The persistent book shell. The four surfaces (Reader / Graph / Study /
 * Notebook) render through the Outlet inside one frame, so switching between
 * them is a transition, not a white-flash page swap. Keyed on the FACET (not
 * the full path) so flipping chapters stays in-place inside the Reader — only
 * a true surface change remounts and re-enters. The FacetSwitcher lives outside
 * the keyed wrapper so it never re-animates on a switch; its layoutId underline
 * glides between facets instead.
 */
export default function BookLayout() {
  const location = useLocation()
  const facet = currentFacet(location.pathname)
  return (
    <>
      <motion.div
        key={facet}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={tween.enter}
      >
        <Outlet />
      </motion.div>
      <FacetSwitcher />
    </>
  )
}
