import type { Chapter, Book, BookIndex, BookOutline } from './book'

// ─── Server → Client ───────────────────────────────────────────────

export type ServerMessage =
  | { type: 'chapter-updated'; bookId: string; chapterId: string; chapter: Chapter }
  | { type: 'book-updated'; bookId: string; book: Book }
  | { type: 'index-updated'; index: BookIndex }
  | { type: 'outline-updated'; bookId: string; outline: BookOutline }
  | { type: 'connected'; clientId: string }
  | { type: 'heartbeat' }

// ─── Client → Server ───────────────────────────────────────────────

export type ClientMessage =
  | { type: 'subscribe'; bookId: string; chapterId?: string }
  | { type: 'unsubscribe'; bookId: string }
  | { type: 'pong' }
