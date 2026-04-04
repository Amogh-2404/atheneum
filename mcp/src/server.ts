import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { resolveContentDir } from './lib/content-dir.js'
import { registerReadingTools } from './tools/reading.js'
import { registerWritingTools } from './tools/writing.js'
import { registerScaffoldingTools } from './tools/scaffolding.js'
import { registerHistoryTools } from './tools/history.js'
import { registerAnnotationTools } from './tools/annotations.js'
import { registerExportTools } from './tools/export.js'
import { registerResources } from './resources.js'
import { registerPrompts } from './prompts.js'

export function createAtheneumServer(): McpServer {
  const contentDir = resolveContentDir()
  console.error(`[atheneum-mcp] Content directory: ${contentDir}`)

  const server = new McpServer({
    name: 'atheneum',
    version: '0.1.0',
  })

  // Register all tools
  registerReadingTools(server, contentDir)
  registerWritingTools(server, contentDir)
  registerScaffoldingTools(server, contentDir)
  registerHistoryTools(server, contentDir)
  registerAnnotationTools(server, contentDir)
  registerExportTools(server, contentDir)

  // Register resources and prompts
  registerResources(server, contentDir)
  registerPrompts(server, contentDir)

  console.error(`[atheneum-mcp] Server initialized: 32 tools, 7 resources, 4 prompts`)
  return server
}
