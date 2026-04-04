#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createAtheneumServer } from './server.js'

async function main() {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.error('Usage: atheneum-mcp [options]')
    console.error('')
    console.error('Options:')
    console.error('  --content-dir <path>  Content directory (or set ATHENEUM_CONTENT_DIR)')
    console.error('  --help, -h            Show this help')
    console.error('')
    console.error('Environment:')
    console.error('  ATHENEUM_CONTENT_DIR     Path to content directory')
    process.exit(0)
  }

  const server = createAtheneumServer()

  // stdio transport (primary — works with Claude Desktop, Claude Code, Cursor)
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[atheneum-mcp] Connected via stdio transport')
}

main().catch((err) => {
  console.error('[atheneum-mcp] Fatal error:', err)
  process.exit(1)
})
