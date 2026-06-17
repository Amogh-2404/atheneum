// Reading telemetry — local-first. Raw deltas buffer in IndexedDB and flush as
// aggregates to the server, which fuses them into a per-block struggle score.
// The reading surface NEVER shows this; it is author/Forge-facing only.

export interface BlockDelta {
  blockId: string
  dwellMs: number     // engaged dwell (foreground + active), this flush window
  revisits: number    // isIntersecting false->true transitions, this window
  expectedMs: number  // word-count / reader WPM — the "should take this long" baseline
}

export interface StruggleFlush {
  chapterId: string
  wpm: number
  blocks: BlockDelta[]
}

export interface BlockStruggle {
  score: number       // 0..1, higher = more struggle
  confidence: number  // 0..1, grows with observations (gate display at >=3)
  dwellMs: number
  revisits: number
  expectedMs: number
  obs: number
  topSignal: 'reread' | 'dwell' | 'none'
}

export interface ChapterStruggleMap {
  bookId: string
  updatedAt: string
  wpm: number
  chapters: Record<string, Record<string, BlockStruggle>>
}
