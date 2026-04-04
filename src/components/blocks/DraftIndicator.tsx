import type { ReactNode } from 'react'

interface DraftIndicatorProps {
  isDraft: boolean
  children: ReactNode
}

export default function DraftIndicator({ isDraft, children }: DraftIndicatorProps) {
  if (!isDraft) return <>{children}</>

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
        <span
          className="select-none text-4xl font-bold tracking-widest text-red-500/10 dark:text-red-400/10"
          style={{ transform: 'rotate(-20deg)' }}
        >
          DRAFT
        </span>
      </div>
      {children}
    </div>
  )
}
