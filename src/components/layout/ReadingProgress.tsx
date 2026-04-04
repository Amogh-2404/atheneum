import { useState, useEffect } from 'react'

export default function ReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function onScroll() {
      const scrollTop = window.scrollY
      const docHeight = document.body.scrollHeight - window.innerHeight
      setProgress(docHeight > 0 ? scrollTop / docHeight : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    // Compute initial value
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 260,
        right: 0,
        height: 3,
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: `${progress * 100}%`,
          height: '100%',
          background: 'var(--chrome-accent)',
          transition: 'width 100ms',
        }}
      />
    </div>
  )
}
