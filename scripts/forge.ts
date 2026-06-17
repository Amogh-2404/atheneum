/**
 * The Forge — reads the per-block struggle score, picks the weakest page, and
 * drafts a surgical rewrite through the SAME validatedWrite gate the human path
 * uses. Draft-only, never published; stamped ai-improve-loop so the Reader shows
 * it as "rewritten — review" and the Morning Brief queues it. The reader stays
 * sovereign: nothing reaches the page without a human Keep.
 *
 * SAFE BY DEFAULT:
 *   - autonomous model drafting requires FORGE_ENABLED=1 (off otherwise)
 *   - --dry-run  : rank + print candidates, write nothing
 *   - --stub     : write a clearly-marked stub draft (verifies the write path
 *                  with no model call, no fabricated content)
 *   - one draft per block (hard dedup), only TEXT blocks, --max caps per run
 *
 *   tsx scripts/forge.ts <bookId> [--dry-run|--stub] [--max N]
 *                        [--min-score 0.6] [--min-confidence 0.66]
 */
import { readFileSync, existsSync, readdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execFileSync } from 'child_process'
import { validatedWrite } from '../server/lib/write-gate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTENT = path.join(__dirname, '..', 'content')

const argv = process.argv.slice(2)
const bookId = argv.find((a) => !a.startsWith('--'))
const dryRun = argv.includes('--dry-run')
const stub = argv.includes('--stub')
const num = (flag: string, def: number) => {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] != null ? Number(argv[i + 1]) : def
}
const MAX = num('--max', 1)
const MIN_SCORE = num('--min-score', 0.6)
const MIN_CONF = num('--min-confidence', 0.66)

if (!bookId) {
  console.error('usage: tsx scripts/forge.ts <bookId> [--dry-run|--stub] [--max N]')
  process.exit(1)
}
if (!dryRun && !stub && process.env.FORGE_ENABLED !== '1') {
  console.error('Forge autonomous drafting is OFF. Set FORGE_ENABLED=1 to draft for real, or pass --dry-run / --stub.')
  process.exit(2)
}

const bookDir = path.join(CONTENT, bookId)
const strugglePath = path.join(bookDir, '.state', 'struggle.json')
if (!existsSync(strugglePath)) {
  console.error(`no struggle data at ${strugglePath} — nothing to forge`)
  process.exit(0)
}

interface BlockStruggle { score: number; confidence: number; topSignal: string; obs: number }
const struggle = JSON.parse(readFileSync(strugglePath, 'utf-8')) as {
  chapters: Record<string, Record<string, BlockStruggle>>
}

// ── Rank candidates across the book ──
interface Candidate { chapterId: string; blockId: string; s: BlockStruggle }
const ranked: Candidate[] = []
for (const [chapterId, blocks] of Object.entries(struggle.chapters || {})) {
  for (const [blockId, s] of Object.entries(blocks)) {
    if (s.score >= MIN_SCORE && s.confidence >= MIN_CONF) ranked.push({ chapterId, blockId, s })
  }
}
ranked.sort((a, b) => b.s.score - a.s.score || b.s.confidence - a.s.confidence)

if (ranked.length === 0) {
  console.log(`No blocks above score>=${MIN_SCORE} confidence>=${MIN_CONF}. The book is reading clean.`)
  process.exit(0)
}

const chapterPath = (chId: string) => path.join(bookDir, 'chapters', `${chId}.json`)
const loadChapter = (chId: string) => JSON.parse(readFileSync(chapterPath(chId), 'utf-8'))

function alreadyDrafted(chapter: any, blockId: string): boolean {
  return (chapter.blocks || []).some(
    (b: any) => b.status === 'draft' && (b.metadata?.revisionOf === blockId || b.metadata?.insertedAfter === blockId),
  )
}

function generateRewrite(originalText: string, signal: string): string {
  if (stub) return `[Forge stub draft — verify path only, not real content] (${signal}) ${originalText}`
  const prompt =
    `You are revising ONE paragraph of a technical book that a single reader struggled with (${signal}). ` +
    `Rewrite it to be clearer and more concrete WITHOUT adding any claim you cannot support from the original. ` +
    `Do not invent facts. Return ONLY the rewritten paragraph, no preamble.\n\nORIGINAL:\n${originalText}`
  // Real drafting shells out to the local claude CLI (gated behind FORGE_ENABLED).
  const out = execFileSync('claude', ['-p', prompt], { encoding: 'utf-8', timeout: 120000 })
  return out.trim()
}

function blockText(b: any): string {
  if (typeof b.text === 'string') return b.text
  if (Array.isArray(b.text)) return b.text.map((s: any) => s.text || '').join('')
  return ''
}

let drafted = 0
for (const cand of ranked) {
  if (drafted >= MAX) break
  const chapter = loadChapter(cand.chapterId)
  const idx = (chapter.blocks || []).findIndex((b: any) => b.id === cand.blockId)
  if (idx < 0) continue
  const target = chapter.blocks[idx]
  if (target.type !== 'text') continue // only prose for v1
  if (alreadyDrafted(chapter, cand.blockId)) {
    console.log(`skip ${cand.chapterId}/${cand.blockId} — already has a pending draft`)
    continue
  }

  const signal = `struggle:${cand.s.score} (${cand.s.topSignal})`
  console.log(`candidate: ${cand.chapterId}/${cand.blockId}  score=${cand.s.score} conf=${cand.s.confidence} signal=${cand.s.topSignal}`)
  if (dryRun) { drafted++; continue }

  const newText = generateRewrite(blockText(target), signal)
  const draft = {
    id: 'blk_' + Math.random().toString(36).slice(2, 8),
    type: 'text',
    status: 'draft',
    text: newText,
    metadata: {
      origin: 'ai-improve-loop',
      insertedAfter: cand.blockId,
      revisionOf: cand.blockId,
      sourceSignal: signal,
    },
  }

  await validatedWrite(chapterPath(cand.chapterId), (current: any) => {
    if (!current) throw new Error('chapter vanished')
    const at = current.blocks.findIndex((b: any) => b.id === cand.blockId)
    if (at < 0) throw new Error('target block vanished')
    if (current.blocks.some((b: any) => b.status === 'draft' && b.metadata?.revisionOf === cand.blockId)) return current
    current.blocks.splice(at + 1, 0, draft)
    return current
  })
  console.log(`  → drafted ${draft.id} after ${cand.blockId} (${cand.chapterId})`)
  drafted++
}

console.log(`\nForge done — ${drafted} draft(s) ${dryRun ? 'identified (dry-run)' : 'written'}. Review in the Morning Brief; nothing is published until you Keep.`)
