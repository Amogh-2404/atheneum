<p align="center">
  <img src="public/logo.svg" width="80" alt="Atheneum logo" />
</p>

<h1 align="center">Atheneum</h1>

<p align="center">
  <strong>The AI-native textbook platform.</strong><br />
  AI writes structured chapters with quizzes, diagrams, and flashcards.<br />
  You read them in a beautiful notebook.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="#mcp-server">MCP Server</a> &bull;
  <a href="#block-types">Block Types</a> &bull;
  <a href="CONTENT_FORMAT.md">Content Format</a> &bull;
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

## What is Atheneum?

Atheneum turns any MCP-compatible AI (Claude Desktop, Claude Code, Cursor) into a personal textbook author. Tell it what to teach, and it produces structured, pedagogically-sound chapters with:

- **Quiz blocks** that test understanding after each concept
- **Flashcard blocks** for spaced repetition review
- **Interactive diagrams** (Excalidraw — click to explore)
- **Code blocks** with syntax highlighting and line annotations
- **Math blocks** with LaTeX/KaTeX rendering
- **Callout blocks** with semantic variants (definition, warning, tip, key-concept)
- **18 block types total** — each designed for learning, not just display

Content renders in a beautiful notebook UI with 3 themes (light, dark, sepia), ruled lines, handwritten fonts, and a reading experience that feels like a real book.

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/Amogh-2404/atheneum.git
cd atheneum
npm install
cd mcp && npm install && cd ..
```

### 2. Start the server

```bash
# Web server (API + reader on port 3100)
npm run start

# Or for development (with hot reload)
npm run dev:server  # Backend on 3100
npm run dev         # Frontend on 5200
```

### 3. Connect an AI client

Add the MCP server to your AI client of choice:

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "atheneum": {
      "command": "npx",
      "args": ["tsx", "/path/to/atheneum/mcp/src/index.ts"],
      "env": { "ATHENEUM_CONTENT_DIR": "/path/to/atheneum/content" }
    }
  }
}
```

**Claude Code** (`.mcp.json` in project root — already included):
```json
{
  "mcpServers": {
    "atheneum": {
      "command": "npx",
      "args": ["tsx", "mcp/src/index.ts"],
      "env": { "ATHENEUM_CONTENT_DIR": "./content" }
    }
  }
}
```

### 4. Start learning

In your AI client:
> "Teach me about order books in trading"

The AI uses the `teach_chapter` prompt and `write_chapter` tool to create a structured chapter. Open `http://localhost:3100` to read it — content appears live within 600ms.

---

## How It Works

```
  AI Client (Claude, Cursor, ...)
       │
       │  MCP protocol (stdio or HTTP)
       ▼
  Atheneum MCP Server (32 tools)
       │
       │  writes JSON files
       ▼
  content/ directory
       │
       │  chokidar detects changes (~600ms)
       ▼
  Hono Web Server
       │
       ├── git auto-commit
       └── WebSocket broadcast
              │
              ▼
         React Reader (browser)
```

The filesystem IS the message bus. Any process that writes to `content/` triggers a live update in the browser. Git commits happen automatically.

---

## MCP Server

**32 tools** across 7 categories:

| Category | Tools |
|----------|-------|
| **Reading** | `list_books`, `get_book`, `get_chapter`, `get_outline`, `search_content`, `get_stats`, `validate_content` |
| **Writing** | `write_chapter`, `insert_blocks`, `update_blocks`, `remove_blocks`, `move_blocks`, `delete_chapter`, `duplicate_chapter`, `move_chapter`, `import_markdown` |
| **Scaffolding** | `create_book`, `update_book_metadata`, `update_outline`, `set_chapter_status`, `delete_book`, `archive_book`, `unarchive_book`, `reorder_chapters`, `cleanup_orphans`, `rename_book` |
| **History** | `list_versions`, `get_version`, `revert_chapter` |
| **Annotations** | `get_annotations`, `get_confusion_markers` |
| **Export** | `export_markdown` |

**7 resources** with `atheneum://` URI scheme for context injection.

**4 prompts** encoding the teaching methodology: `teach_chapter`, `improve_chapter`, `review_content`, `plan_book`.

---

## Block Types

Atheneum uses 18 typed content blocks. Every block has an `id`, `type`, `status` (draft/published), and optional `metadata`.

| Type | Purpose | Key Fields |
|------|---------|-----------|
| `heading` | Section titles | `level` (1-3), `text` |
| `text` | Paragraphs | `text` (plain string or RichText) |
| `callout` | Definitions, warnings, tips | `variant`, `title`, `text`, `icon` |
| `code` | Code with syntax highlighting | `language`, `code`, `annotations` |
| `diagram` | Interactive Excalidraw diagrams | `inlineData`, `caption` |
| `figure` | Images with captions | `src`, `alt`, `caption`, `layout` |
| `quote` | Blockquotes | `text`, `attribution` |
| `list` | Ordered/unordered lists | `style`, `items` (recursive) |
| `divider` | Section breaks | `style` (line/dots/wave/flourish) |
| `math` | LaTeX equations | `expression`, `display` |
| `table` | Data tables | `headers`, `rows`, `caption` |
| `toggle` | Expandable sections | `title`, `content` (nested blocks) |
| `timeline` | Event sequences | `events` (title, description, icon) |
| `quiz` | Test understanding | `questions` (options, correctIndex) |
| `flashcard` | Spaced repetition | `cards` (front, back) |
| `summary` | Key takeaways | `points` |
| `embed` | External content | `url`, `title` |
| `margin-annotation` | Margin notes | `text`, `author` |

See [CONTENT_FORMAT.md](CONTENT_FORMAT.md) for complete schemas and examples.

---

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind
- **Backend**: Hono + Node.js (tsx)
- **MCP Server**: `@modelcontextprotocol/sdk` + Zod
- **Content**: JSON files in `content/` directory, git-backed
- **Real-time**: chokidar + WebSocket
- **Rendering**: Shiki (code), KaTeX (math), Excalidraw (diagrams), Rough.js (hand-drawn borders), Framer Motion (animations)

---

## License

[MIT](LICENSE)
