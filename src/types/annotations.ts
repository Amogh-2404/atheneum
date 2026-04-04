// ─── Annotation Base ───────────────────────────────────────────────

export interface AnnotationBase {
  id: string
  bookId: string
  chapterId: string
  createdAt: string
  updatedAt: string
}

// ─── Annotation Types ──────────────────────────────────────────────

export interface Highlight extends AnnotationBase {
  type: 'highlight'
  blockId: string
  startOffset: number
  endOffset: number
  color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple'
  note?: string
}

export interface Bookmark extends AnnotationBase {
  type: 'bookmark'
  blockId: string
  label?: string
}

export interface MarginNote extends AnnotationBase {
  type: 'margin-note'
  blockId: string
  text: string
  position: 'left' | 'right'
}

export interface ConfusionMarker extends AnnotationBase {
  type: 'confusion'
  blockId: string
  note?: string
}

export type UserAnnotation = Highlight | Bookmark | MarginNote | ConfusionMarker

// ─── Reading Preferences ───────────────────────────────────────────

export interface ReadingPreferences {
  theme: 'light' | 'dark' | 'sepia'
  fontSize: number
  lineHeight: number
  maxWidth: string
  fontFamily: 'default' | 'dyslexia'
  letterSpacing: number
  showAnnotations: boolean
  sidebarCollapsed: boolean
  reduceMotion: boolean
}

// ─── Reading Position ──────────────────────────────────────────────

export interface ReadingPosition {
  bookId: string
  chapterId: string
  scrollPercent: number
  timestamp: string
}
