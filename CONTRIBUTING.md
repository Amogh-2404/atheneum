# Contributing to Atheneum

Thank you for considering contributing to Atheneum. Every contribution matters.

## Development Setup

```bash
# Clone
git clone https://github.com/Amogh-2404/atheneum.git
cd atheneum

# Install dependencies
npm install
cd mcp && npm install && cd ..

# Start the web server (port 3100)
npm run dev:server

# Start the frontend dev server (port 5200)
npm run dev

# Start the MCP server (for testing tools)
cd mcp && npm run dev
```

## Project Structure

```
atheneum/
├── server/          # Hono web server (REST API + WebSocket + file watcher)
├── mcp/             # MCP server (32 tools, 7 resources, 4 prompts)
├── src/             # React frontend (Vite + TypeScript)
│   ├── pages/       # Bookshelf, Reader, KnowledgeGraph
│   ├── components/  # Block renderers, annotations, UI
│   ├── hooks/       # Custom React hooks
│   ├── lib/         # Utilities (render-text, export, search)
│   └── styles/      # CSS (notebook, terminal, print, fonts)
├── content/         # Content directory (books, chapters, annotations)
├── public/          # Static assets (icons, fonts, textures)
└── landing/         # Landing page (static HTML)
```

## Content Format

See [CONTENT_FORMAT.md](CONTENT_FORMAT.md) for the full block type specification.

## Guidelines

- **TypeScript**: All code is TypeScript. Run `npx tsc --noEmit` before submitting.
- **No `console.log` in MCP server**: Use `console.error` only (stdout is the protocol).
- **Block IDs**: Format `blk_` + 5 random alphanumeric characters.
- **Git commits**: Prefix content changes with `[atheneum]`.
- **Test visually**: Take screenshots before and after UI changes.
- **Respect the two-zone design**: Chrome zone (dark, UI) vs Notebook zone (warm, paper).

## Pull Requests

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Run `npx tsc --noEmit` and `npm run build`
5. Submit a PR with a clear description

## Reporting Issues

Open an issue on GitHub with:
- What you expected
- What happened instead
- Screenshots if it's a visual issue
- Browser/OS info
