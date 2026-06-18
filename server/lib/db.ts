// The single SQLite module for Atheneum's mutable user-state (reading position,
// learning progress, annotations, struggle telemetry). Content — books, chapters,
// figures — is NEVER here; it stays as JSON-in-git (diffable, watched, revertable).
//
// Why SQLite for user-state: the old loose-JSON files did whole-file read-modify-write
// on every save (lost-update races, torn-write corruption, one non-atomic writer in
// reading-position). better-sqlite3 is synchronous, so within this single Node process
// every mutator runs to completion atomically — no lockfile needed for these routes.
// The DB is one portable file under .data/ (gitignored, watcher-invisible, backed up
// off-box by scripts/aco/backup.sh).
import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', '..', '.data')      // repo-root/.data
const CONTENT_DIR = path.join(__dirname, '..', '..', 'content')
mkdirSync(DATA_DIR, { recursive: true })

export const db: Database.Database = new Database(path.join(DATA_DIR, 'atheneum.db'), { timeout: 5000 })

// Order matters: WAL is persistent (set once), the rest are per-connection. WAL
// before synchronous=NORMAL (NORMAL is crash-safe specifically under WAL — only a
// power-cut can lose the last transaction, never corrupt the db).
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')
db.pragma('synchronous = NORMAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS reading_position (
    book_id        TEXT PRIMARY KEY,
    chapter_id     TEXT NOT NULL,
    scroll_percent REAL NOT NULL,
    timestamp      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS learning_progress (
    book_id    TEXT PRIMARY KEY,
    data       TEXT NOT NULL,            -- the entire progress object, verbatim JSON
    updated_at TEXT NOT NULL             -- staleness guard ('' when the client omits it)
  );

  CREATE TABLE IF NOT EXISTS annotations (
    id         TEXT NOT NULL,
    book_id    TEXT NOT NULL,
    type       TEXT,                     -- lifted for the /confusion filter
    data       TEXT NOT NULL,            -- the FULL annotation object, verbatim
    created_at TEXT,                     -- nullable; client-supplied
    seq        INTEGER NOT NULL,         -- preserves insertion order on read (Map-faithful)
    PRIMARY KEY (book_id, id)
  );
  CREATE INDEX IF NOT EXISTS idx_annotations_book      ON annotations(book_id);
  CREATE INDEX IF NOT EXISTS idx_annotations_book_type ON annotations(book_id, type);

  CREATE TABLE IF NOT EXISTS struggle (
    book_id    TEXT PRIMARY KEY,
    data       TEXT NOT NULL,            -- { bookId, chapters, wpm, updatedAt } verbatim
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS _migrations (
    name       TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
`)

/* ─── reading position ────────────────────────────────────────────── */
const stmtGetPos = db.prepare('SELECT chapter_id, scroll_percent, timestamp FROM reading_position WHERE book_id = ?')
const stmtPutPos = db.prepare(`
  INSERT INTO reading_position (book_id, chapter_id, scroll_percent, timestamp)
  VALUES (@bookId, @chapterId, @scrollPercent, @timestamp)
  ON CONFLICT(book_id) DO UPDATE SET
    chapter_id = excluded.chapter_id, scroll_percent = excluded.scroll_percent, timestamp = excluded.timestamp
`)

export interface ReadingPosition { bookId: string; chapterId: string; scrollPercent: number; timestamp: string }

export function getReadingPosition(bookId: string): ReadingPosition | null {
  const row = stmtGetPos.get(bookId) as { chapter_id: string; scroll_percent: number; timestamp: string } | undefined
  if (!row) return null
  // Reconstruct the exact on-disk/envelope shape (key order matches the old POST writer).
  return { bookId, chapterId: row.chapter_id, scrollPercent: row.scroll_percent, timestamp: row.timestamp }
}

export function saveReadingPosition(p: ReadingPosition): void {
  stmtPutPos.run(p)
}

/* ─── learning progress (whole-document blob + staleness guard) ───── */
const stmtGetLP = db.prepare('SELECT data, updated_at FROM learning_progress WHERE book_id = ?')
const stmtPutLP = db.prepare(`
  INSERT INTO learning_progress (book_id, data, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(book_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
`)

export function getLearningProgress(bookId: string): any | null {
  const row = stmtGetLP.get(bookId) as { data: string } | undefined
  if (!row) return null
  try { return JSON.parse(row.data) } catch { return null }
}

// Returns false (and writes nothing) when the stored copy is strictly newer — the
// exact guard the old route had: only blocks when BOTH timestamps exist and server wins.
export const saveLearningProgress = db.transaction((bookId: string, body: any): boolean => {
  const row = stmtGetLP.get(bookId) as { updated_at: string } | undefined
  if (row && row.updated_at && body.updatedAt && row.updated_at > body.updatedAt) return false
  stmtPutLP.run(bookId, JSON.stringify(body), body.updatedAt ?? '')
  return true
})

/* ─── annotations (one row per annotation, merge-by-id) ───────────── */
const stmtGetAnns = db.prepare('SELECT data FROM annotations WHERE book_id = ? ORDER BY seq')
const stmtGetConfusion = db.prepare("SELECT data FROM annotations WHERE book_id = ? AND type = 'confusion' ORDER BY seq")
const stmtCountAnns = db.prepare('SELECT COUNT(*) AS n FROM annotations WHERE book_id = ?')
const stmtMaxSeq = db.prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM annotations WHERE book_id = ?')
const stmtDelAnn = db.prepare('DELETE FROM annotations WHERE book_id = ? AND id = ?')
// Upsert keeps an existing annotation's seq (position) and only bumps it for new ids —
// mirrors Map.set (existing key keeps slot, new key appended).
const stmtPutAnn = db.prepare(`
  INSERT INTO annotations (book_id, id, type, data, created_at, seq)
  VALUES (@book_id, @id, @type, @data, @created_at, @seq)
  ON CONFLICT(book_id, id) DO UPDATE SET type = excluded.type, data = excluded.data, created_at = excluded.created_at
`)

function rowsToData(rows: { data: string }[]): any[] {
  const out: any[] = []
  for (const r of rows) { try { out.push(JSON.parse(r.data)) } catch { /* skip torn row */ } }
  return out
}

export function getAnnotations(bookId: string): any[] {
  return rowsToData(stmtGetAnns.all(bookId) as { data: string }[])
}
export function getConfusionAnnotations(bookId: string): any[] {
  return rowsToData(stmtGetConfusion.all(bookId) as { data: string }[])
}

// Merge incoming by id (incoming replaces, new appended), return the new total.
export const syncAnnotations = db.transaction((bookId: string, incoming: any[]): number => {
  let seq = (stmtMaxSeq.get(bookId) as { m: number }).m
  for (const ann of incoming) {
    if (!ann || !ann.id) continue
    stmtPutAnn.run({
      book_id: bookId, id: String(ann.id), type: ann.type ?? null,
      data: JSON.stringify(ann), created_at: ann.createdAt ?? null, seq: ++seq,
    })
  }
  return (stmtCountAnns.get(bookId) as { n: number }).n
})

export function deleteAnnotation(bookId: string, id: string): boolean {
  return stmtDelAnn.run(bookId, id).changes > 0
}

/* ─── struggle (fused blob; reproduce the exact accumulate) ───────── */
const stmtGetStruggle = db.prepare('SELECT data FROM struggle WHERE book_id = ?')
const stmtPutStruggle = db.prepare(`
  INSERT INTO struggle (book_id, data, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(book_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
`)

interface Acc { dwellMs: number; revisits: number; expectedMs: number; obs: number }
// Identical to the old struggle.ts scoreBlock — preserved byte-for-byte.
function scoreBlock(b: Acc) {
  const revisitScore = Math.min(b.revisits / 3, 1)
  const dwellScore = b.expectedMs > 0 ? Math.max(0, Math.min(1, (b.dwellMs / b.expectedMs - 1) / 2)) : 0
  const score = Math.round((0.6 * revisitScore + 0.4 * dwellScore) * 100) / 100
  const topSignal = revisitScore === 0 && dwellScore === 0 ? 'none' : revisitScore >= dwellScore ? 'reread' : 'dwell'
  const confidence = Math.min(b.obs / 3, 1)
  return { ...b, score, confidence, topSignal }
}

export function getStruggle(bookId: string): any | null {
  const row = stmtGetStruggle.get(bookId) as { data: string } | undefined
  if (!row) return null
  try { return JSON.parse(row.data) } catch { return null }
}

// Accumulate body.blocks into the per-book/per-chapter map — same clamps & merge as before.
export const saveStruggle = db.transaction((bookId: string, body: any): void => {
  const existing = stmtGetStruggle.get(bookId) as { data: string } | undefined
  let map: any = { bookId, chapters: {}, wpm: 0, updatedAt: new Date(0).toISOString() }
  if (existing) { try { map = JSON.parse(existing.data) } catch { /* overwrite if corrupt */ } }
  if (!map.chapters) map.chapters = {}
  map.bookId = bookId
  if (typeof body.wpm === 'number' && body.wpm > 0) map.wpm = Math.round(body.wpm)
  const chId = String(body.chapterId || '')
  if (!map.chapters[chId]) map.chapters[chId] = {}
  const ch = map.chapters[chId]
  for (const d of body.blocks) {
    if (!d || typeof d.blockId !== 'string') continue
    const prev: Acc = ch[d.blockId] || { dwellMs: 0, revisits: 0, expectedMs: 0, obs: 0 }
    const merged: Acc = {
      dwellMs: prev.dwellMs + Math.max(0, Math.min(180000, Number(d.dwellMs) || 0)),
      revisits: prev.revisits + Math.max(0, Number(d.revisits) || 0),
      expectedMs: Number(d.expectedMs) || prev.expectedMs || 0,
      obs: prev.obs + 1,
    }
    ch[d.blockId] = scoreBlock(merged)
  }
  map.updatedAt = new Date().toISOString()
  stmtPutStruggle.run(bookId, JSON.stringify(map), map.updatedAt)
})

/* ─── one-time migration: import any existing .state/.annotations JSON ─ */
// Idempotent (sentinel + UPSERT). The JSON files don't exist yet on this machine,
// so this is a no-op today — but it makes the cutover safe on any box that DOES have
// them, and re-running converges. JSON sidecars are LEFT in place (sentinel short-
// circuits next boot); a later cleanup PR removes them after one prod cycle.
function readJSON(p: string): any | null {
  try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : null } catch { return null }
}

const runMigration = db.transaction(() => {
  const done = db.prepare("SELECT 1 FROM _migrations WHERE name = 'json_state_v1'").get()
  if (done) return
  let books: string[] = []
  try { books = readdirSync(CONTENT_DIR).filter((d) => !d.startsWith('.')) } catch { /* no content dir */ }
  for (const book of books) {
    const base = path.join(CONTENT_DIR, book)
    const pos = readJSON(path.join(base, '.state', 'reading-position.json'))
    if (pos && pos.chapterId != null && pos.scrollPercent != null) {
      stmtPutPos.run({ bookId: book, chapterId: String(pos.chapterId), scrollPercent: Number(pos.scrollPercent), timestamp: pos.timestamp || new Date().toISOString() })
    }
    const lp = readJSON(path.join(base, '.state', 'learning-progress.json'))
    if (lp) stmtPutLP.run(book, JSON.stringify(lp), lp.updatedAt ?? '')
    const st = readJSON(path.join(base, '.state', 'struggle.json'))
    if (st) stmtPutStruggle.run(book, JSON.stringify(st), st.updatedAt ?? '')
    const anns = readJSON(path.join(base, '.annotations', 'annotations.json'))
    if (Array.isArray(anns)) {
      let seq = (stmtMaxSeq.get(book) as { m: number }).m
      for (const a of anns) {
        if (!a || !a.id) continue
        stmtPutAnn.run({ book_id: book, id: String(a.id), type: a.type ?? null, data: JSON.stringify(a), created_at: a.createdAt ?? null, seq: ++seq })
      }
    }
  }
  db.prepare("INSERT OR IGNORE INTO _migrations (name, applied_at) VALUES ('json_state_v1', ?)").run(new Date().toISOString())
  console.log(`[db] migrated user-state for ${books.length} book(s) into SQLite (json_state_v1)`)
})

runMigration()
