import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { execSync } from 'child_process'
import { sanitizeId, safePath } from '../../../server/utils.js'

const GIT_TIMEOUT = 5000 // 5s timeout for git commands

function gitExec(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, timeout: GIT_TIMEOUT, encoding: 'utf-8' }).trim()
}

function isGitRepo(contentDir: string): boolean {
  try {
    gitExec('git rev-parse --is-inside-work-tree', contentDir)
    return true
  } catch {
    return false
  }
}

export function registerHistoryTools(server: McpServer, contentDir: string) {

  // ─── list_versions ───────────────────────────────────────────────
  server.tool(
    'list_versions',
    'List git commit history for a chapter. Returns empty if no git repo.',
    {
      bookId: z.string(),
      chapterId: z.string(),
      limit: z.number().optional().default(20),
    },
    async ({ bookId, chapterId, limit }) => {
      try {
        if (!isGitRepo(contentDir)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ commits: [] }) }] }
        }

        const cleanBook = sanitizeId(bookId)
        const cleanChapter = sanitizeId(chapterId)
        if (!cleanBook || !cleanChapter) return { content: [{ type: 'text' as const, text: `list_versions failed: invalid IDs` }], isError: true }

        const relPath = `${cleanBook}/chapters/${cleanChapter}.json`
        const absPath = safePath(contentDir, cleanBook, 'chapters', `${cleanChapter}.json`)
        if (!absPath) return { content: [{ type: 'text' as const, text: `list_versions failed: path traversal` }], isError: true }

        try {
          const output = gitExec(
            `git log -n ${limit ?? 20} --format="%H|%s|%ai" -- "${relPath}"`,
            contentDir
          )

          if (!output) {
            return { content: [{ type: 'text' as const, text: JSON.stringify({ commits: [] }) }] }
          }

          const commits = output.split('\n').filter(Boolean).map(line => {
            const [hash, message, date] = line.split('|')
            return { hash, message, date }
          })

          return { content: [{ type: 'text' as const, text: JSON.stringify({ commits }, null, 2) }] }
        } catch {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ commits: [] }) }] }
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `list_versions failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── get_version ─────────────────────────────────────────────────
  server.tool(
    'get_version',
    'Get a chapter\'s content at a specific git commit hash',
    {
      bookId: z.string(),
      chapterId: z.string(),
      hash: z.string().regex(/^[0-9a-f]{7,40}$/).describe('Git commit hash (7-40 hex chars)'),
    },
    async ({ bookId, chapterId, hash }) => {
      try {
        if (!isGitRepo(contentDir)) {
          return { content: [{ type: 'text' as const, text: `get_version failed: no git repository found` }], isError: true }
        }

        const cleanBook = sanitizeId(bookId)
        const cleanChapter = sanitizeId(chapterId)
        if (!cleanBook || !cleanChapter) return { content: [{ type: 'text' as const, text: `get_version failed: invalid IDs` }], isError: true }

        const relPath = `${cleanBook}/chapters/${cleanChapter}.json`

        const output = gitExec(`git show ${hash}:"${relPath}"`, contentDir)
        const chapter = JSON.parse(output)

        return { content: [{ type: 'text' as const, text: JSON.stringify(chapter, null, 2) }] }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `get_version failed: ${err.message}` }], isError: true }
      }
    }
  )

  // ─── revert_chapter ──────────────────────────────────────────────
  server.tool(
    'revert_chapter',
    'Revert a chapter to a previous version. Creates a new git commit. WARNING: destructive — replaces current content.',
    {
      bookId: z.string(),
      chapterId: z.string(),
      hash: z.string().regex(/^[0-9a-f]{7,40}$/).describe('Git commit hash to revert to'),
    },
    async ({ bookId, chapterId, hash }) => {
      try {
        if (!isGitRepo(contentDir)) {
          return { content: [{ type: 'text' as const, text: `revert_chapter failed: no git repository found` }], isError: true }
        }

        const cleanBook = sanitizeId(bookId)
        const cleanChapter = sanitizeId(chapterId)
        if (!cleanBook || !cleanChapter) return { content: [{ type: 'text' as const, text: `revert_chapter failed: invalid IDs` }], isError: true }

        const relPath = `${cleanBook}/chapters/${cleanChapter}.json`

        // Checkout the file at the specified hash
        gitExec(`git checkout ${hash} -- "${relPath}"`, contentDir)

        // Commit the revert
        const shortHash = hash.slice(0, 7)
        gitExec(`git add "${relPath}"`, contentDir)
        gitExec(`git commit -m "[atheneum] Revert ${cleanChapter} to ${shortHash}"`, contentDir)

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ reverted: true, fromHash: shortHash }, null, 2),
          }],
        }
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: `revert_chapter failed: ${err.message}` }], isError: true }
      }
    }
  )
}
