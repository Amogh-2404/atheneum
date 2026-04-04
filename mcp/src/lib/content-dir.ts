import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Resolve the content directory from (in priority order):
 * 1. ATHENEUM_CONTENT_DIR env var
 * 2. --content-dir CLI arg
 * 3. Relative to project: ../../content (dev default)
 */
export function resolveContentDir(): string {
  // 1. Environment variable (primary — set in MCP registration config)
  if (process.env.ATHENEUM_CONTENT_DIR) {
    const dir = path.resolve(process.env.ATHENEUM_CONTENT_DIR)
    if (existsSync(dir)) return dir
    console.error(`[atheneum-mcp] ATHENEUM_CONTENT_DIR="${dir}" does not exist, falling back`)
  }

  // 2. CLI argument
  const args = process.argv.slice(2)
  const cdIdx = args.indexOf('--content-dir')
  if (cdIdx !== -1 && args[cdIdx + 1]) {
    const dir = path.resolve(args[cdIdx + 1])
    if (existsSync(dir)) return dir
    console.error(`[atheneum-mcp] --content-dir="${dir}" does not exist, falling back`)
  }

  // 3. Dev default: relative to this file → mcp/src/lib → ../../content
  const devDefault = path.resolve(__dirname, '..', '..', '..', 'content')
  if (existsSync(devDefault)) return devDefault

  // If nothing works, return the env var path (or a sensible default) and let tools fail gracefully
  return process.env.ATHENEUM_CONTENT_DIR
    ? path.resolve(process.env.ATHENEUM_CONTENT_DIR)
    : devDefault
}
