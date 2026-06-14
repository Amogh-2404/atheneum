/* ─── Skeleton Loaders ─────────────────────────────────────────────────
   Shimmer-animated placeholders that mirror content shapes.
   Theme-aware: uses CSS variables for colors.
────────────────────────────────────────────────────────────────────── */

const shimmerKeyframes = `
@keyframes shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
`

const baseStyle: React.CSSProperties = {
  borderRadius: 6,
  background: 'linear-gradient(90deg, var(--chrome-surface, #1e293b) 25%, var(--chrome-border, #334155) 50%, var(--chrome-surface, #1e293b) 75%)',
  backgroundSize: '800px 100%',
  animation: 'shimmer 1.8s ease-in-out infinite',
}

function ShimmerBar({ width = '100%', height = 14, style }: {
  width?: string | number
  height?: number
  style?: React.CSSProperties
}) {
  return <div style={{ ...baseStyle, width, height, marginBottom: 8, ...style }} />
}

/** Block-shaped skeleton matching content structure */
export function SkeletonBlock({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ padding: '1rem 0' }}>
      {Array.from({ length: lines }, (_, i) => (
        <ShimmerBar
          key={i}
          width={i === lines - 1 ? '60%' : '100%'}
          height={i === 0 ? 18 : 14}
          style={i === 0 ? { marginBottom: 14 } : undefined}
        />
      ))}
    </div>
  )
}

/** Book card skeleton matching Bookshelf grid layout */
export function SkeletonBookCard() {
  return (
    <div style={{
      borderRadius: 12,
      overflow: 'hidden',
      background: 'var(--chrome-surface, #1e293b)',
      border: '1px solid var(--chrome-border, #334155)',
    }}>
      {/* Cover area */}
      <div style={{ ...baseStyle, height: 180, borderRadius: 0 }} />
      {/* Text area */}
      <div style={{ padding: '1rem' }}>
        <ShimmerBar width="70%" height={16} />
        <ShimmerBar width="90%" height={12} />
        <ShimmerBar width="40%" height={12} />
      </div>
    </div>
  )
}

/** Sidebar chapter list skeleton */
export function SkeletonChapterList({ count = 8 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0.5rem 0.75rem' }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShimmerBar width={18} height={12} style={{ marginBottom: 0, flexShrink: 0 }} />
          <ShimmerBar width={`${55 + Math.random() * 35}%`} height={12} style={{ marginBottom: 0 }} />
        </div>
      ))}
    </div>
  )
}

/** Content area loading: heading + multiple text blocks */
export function SkeletonChapterContent() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Chapter heading */}
      <ShimmerBar width="30%" height={12} style={{ marginBottom: 4 }} />
      <ShimmerBar width="60%" height={28} style={{ marginBottom: 24 }} />
      {/* Text blocks */}
      <SkeletonBlock lines={4} />
      <SkeletonBlock lines={3} />
      <SkeletonBlock lines={5} />
      <SkeletonBlock lines={2} />
    </div>
  )
}

/** Graph placeholder */
export function SkeletonGraph() {
  return (
    <div style={{
      display: 'flex',
      height: '100%',
      minHeight: 400,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        ...baseStyle,
        width: 120,
        height: 120,
        borderRadius: '50%',
      }} />
    </div>
  )
}

/** Inject shimmer keyframes once */
export function ShimmerStyle() {
  return <style>{shimmerKeyframes}</style>
}
