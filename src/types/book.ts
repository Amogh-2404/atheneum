import type { Block } from './blocks'

// ─── Book Index & Summary ──────────────────────────────────────────

export interface BookIndex {
  books: BookSummary[]
}

export interface BookSummary {
  id: string
  title: string
  subtitle?: string
  description: string
  coverColor: string
  coverIcon?: string
  tags: string[]
  chapterCount: number
  createdAt: string
  updatedAt: string
}

export interface Book extends BookSummary {
  chapters: ChapterSummary[]
}

// ─── Chapter ───────────────────────────────────────────────────────

export interface ChapterSummary {
  id: string
  number: number
  title: string
  subtitle?: string
  estimatedReadMinutes: number
  blockCount: number
}

export interface Chapter extends ChapterSummary {
  _schema?: number
  blocks: Block[]
}

// ─── Book Outline ──────────────────────────────────────────────────

export interface BookOutline {
  chapters: ChapterOutlineEntry[]
  conceptIndex: Record<string, {
    definedIn: string
    referencedIn: string[]
    prerequisites: string[]
  }>
  lastAuditedAt?: string
}

export interface ChapterOutlineEntry {
  id: string
  title: string
  concepts: string[]
  prereqs: string[]
  estimatedBlocks: number
  status: 'planned' | 'writing' | 'complete'
}
