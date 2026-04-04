# Changelog

## v0.1.0 — 2026-04-04

### The Foundation

The first public release of Atheneum — the AI-native textbook platform.

**Platform**
- 18 learning block types: heading, text, callout, code, diagram, figure, quote, list, divider, math, table, toggle, timeline, quiz, flashcard, summary, embed, margin-annotation
- 3 beautiful themes: Light (editorial), Dark (terminal), Sepia (leather-bound)
- Real-time sync: file changes appear in browser within 600ms via WebSocket
- Git-backed versioning with full diff viewer and one-click revert
- Annotations: highlights (5 colors), bookmarks, margin notes, confusion markers
- Focus mode, reading position sync, keyboard shortcuts
- Print CSS preserving notebook aesthetic
- Export: PDF (via print), EPUB, Markdown
- PWA with offline support

**MCP Server (32 tools, 7 resources, 4 prompts)**
- Reading: list_books, get_book, get_chapter, get_outline, search_content, get_stats, validate_content
- Writing: write_chapter, insert_blocks, update_blocks, remove_blocks, move_blocks, delete_chapter, duplicate_chapter, move_chapter, import_markdown
- Scaffolding: create_book, update_book_metadata, update_outline, set_chapter_status, delete_book, archive_book, unarchive_book, reorder_chapters, cleanup_orphans, rename_book
- History: list_versions, get_version, revert_chapter
- Annotations: get_annotations, get_confusion_markers
- Export: export_markdown
- Resources: Library index, block schema reference, book/outline/chapter/annotation/confusion URIs
- Prompts: teach_chapter, improve_chapter, review_content, plan_book
- Dual transport: stdio (Claude Desktop, Claude Code) + HTTP (Cursor, remote)

**Infrastructure**
- Hono server on port 3100 with CORS, static serving, SPA fallback
- Chokidar file watcher with 300ms debounce
- Cross-process file locking (proper-lockfile)
- Zod schema validation (advisory mode — never crashes)
- Path traversal protection (sanitizeId + safePath)
- macOS LaunchAgent for auto-start
