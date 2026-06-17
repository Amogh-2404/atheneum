# Atheneum Content Format Specification

Version: 1.0 (`_schema: 1`)

## Directory Structure

```
content/
├── _index.json                    # Master book registry
├── <book-slug>/
│   ├── book.json                  # Book metadata
│   ├── outline.json               # Chapter structure + concept index
│   ├── chapters/
│   │   ├── 01-chapter-slug.json   # Chapter with blocks
│   │   └── 02-chapter-slug.json
│   ├── diagrams/                  # Excalidraw diagram files
│   ├── images/                    # Image assets
│   ├── .annotations/              # User annotations (git-ignored)
│   │   └── annotations.json
│   └── .state/                    # Reading state (git-ignored)
│       └── reading-position.json
```

## Book Index (`_index.json`)

```json
{
  "books": [
    {
      "id": "machine-learning",
      "title": "Machine Learning",
      "subtitle": "From Theory to Practice",
      "description": "A comprehensive guide...",
      "coverColor": "#1a5276",
      "coverIcon": "🤖",
      "tags": ["ml", "python", "statistics"],
      "chapterCount": 8,
      "createdAt": "2026-04-01T00:00:00Z",
      "updatedAt": "2026-04-04T12:00:00Z"
    }
  ]
}
```

## Book Metadata (`book.json`)

```json
{
  "_schema": 1,
  "id": "machine-learning",
  "title": "Machine Learning",
  "subtitle": "From Theory to Practice",
  "description": "A comprehensive guide...",
  "author": "Amogh",
  "createdAt": "2026-04-01T00:00:00Z",
  "updatedAt": "2026-04-04T12:00:00Z",
  "coverColor": "#1a5276",
  "coverIcon": "🤖",
  "status": "draft",
  "tags": ["ml", "python"]
}
```

## Chapter (`chapters/01-chapter-slug.json`)

```json
{
  "_schema": 1,
  "id": "01-linear-regression",
  "number": 1,
  "title": "Linear Regression",
  "subtitle": "Finding the line of best fit",
  "estimatedReadMinutes": 12,
  "blockCount": 25,
  "blocks": [...]
}
```

## Block Types

Every block has these base fields:

```json
{
  "id": "blk_a3f9k",
  "type": "text",
  "status": "draft",
  "metadata": {
    "createdAt": "2026-04-04T12:00:00Z",
    "updatedAt": "2026-04-04T12:00:00Z",
    "insertedAfter": "blk_prev1",
    "movedFrom": "blk_old_id"
  }
}
```

### TextContent

Text fields accept either a plain string or a RichText array:

**Plain string** (supports inline markdown):
```
"This has **bold**, *italic*, `code`, [[concept reference]], and [links](url)."
```

**RichText array** (for precise formatting):
```json
[
  { "text": "Normal text " },
  { "text": "bold text", "annotations": { "bold": true } },
  { "text": " and " },
  { "text": "code", "annotations": { "code": true } },
  { "text": "colored", "annotations": { "color": "#d4af37" } },
  { "text": "linked", "href": "https://example.com" }
]
```

### 1. heading

```json
{
  "id": "blk_xxxxx", "type": "heading", "status": "draft",
  "level": 2,
  "text": "Section Title",
  "anchor": "section-title"
}
```

### 2. text

```json
{
  "id": "blk_xxxxx", "type": "text", "status": "draft",
  "text": "A paragraph with **bold** and [[concept]] references."
}
```

### 3. callout

Variants: `tip`, `warning`, `key-concept`, `example`, `definition`, `note`

```json
{
  "id": "blk_xxxxx", "type": "callout", "status": "draft",
  "variant": "definition",
  "title": "Order Book",
  "text": "A real-time sorted list of buy and sell orders.",
  "icon": "📖"
}
```

### 4. code

```json
{
  "id": "blk_xxxxx", "type": "code", "status": "draft",
  "language": "python",
  "code": "def hello():\n    print('world')",
  "filename": "example.py",
  "highlightLines": [2],
  "annotations": { "2": "This line prints hello" },
  "showLineNumbers": true
}
```

### 5. diagram

```json
{
  "id": "blk_xxxxx", "type": "diagram", "status": "draft",
  "inlineData": { "type": "excalidraw", "version": 2, "elements": [...] },
  "caption": "Order book anatomy",
  "width": "full"
}
```

Width options: `narrow`, `medium`, `full`, `wide`

### 6. figure

```json
{
  "id": "blk_xxxxx", "type": "figure", "status": "draft",
  "src": "/content/book-id/images/diagram.png",
  "alt": "Architecture diagram",
  "caption": "System overview",
  "layout": "center",
  "width": "80%"
}
```

Layout options: `full`, `left`, `right`, `center`

### 7. quote

```json
{
  "id": "blk_xxxxx", "type": "quote", "status": "draft",
  "text": "The only way to do great work is to love what you do.",
  "attribution": "Steve Jobs",
  "source": "Stanford Commencement, 2005"
}
```

### 8. list

```json
{
  "id": "blk_xxxxx", "type": "list", "status": "draft",
  "style": "unordered",
  "items": [
    { "text": "First item" },
    { "text": "Second item", "children": [
      { "text": "Nested item" }
    ]}
  ]
}
```

### 9. divider

```json
{
  "id": "blk_xxxxx", "type": "divider", "status": "draft",
  "style": "flourish"
}
```

Style options: `line`, `dots`, `wave`, `flourish`

### 10. math

```json
{
  "id": "blk_xxxxx", "type": "math", "status": "draft",
  "expression": "E = mc^2",
  "display": true
}
```

Uses KaTeX syntax. `display: true` renders as block equation, `false` renders inline.

### 11. table

```json
{
  "id": "blk_xxxxx", "type": "table", "status": "draft",
  "headers": ["Side", "Price", "Quantity"],
  "rows": [
    ["BID", "₹35,000", "2 units"],
    ["ASK", "₹38,000", "1 unit"]
  ],
  "caption": "Order book snapshot"
}
```

### 12. toggle

Contains nested blocks (any type):

```json
{
  "id": "blk_xxxxx", "type": "toggle", "status": "draft",
  "title": "Solution (click to reveal)",
  "content": [
    { "id": "blk_inner1", "type": "text", "status": "draft", "text": "The answer is 42." }
  ]
}
```

### 13. timeline

```json
{
  "id": "blk_xxxxx", "type": "timeline", "status": "draft",
  "events": [
    { "title": "Data Collection", "description": "Gather training data", "icon": "📊" },
    { "title": "Model Training", "description": "Fit the model", "icon": "🧠" }
  ]
}
```

### 14. quiz

```json
{
  "id": "blk_xxxxx", "type": "quiz", "status": "draft",
  "questions": [
    {
      "id": "q1",
      "question": "What is the spread?",
      "options": [
        "The highest bid",
        "The difference between best bid and best ask",
        "The total volume",
        "The mid price"
      ],
      "correctIndex": 1,
      "explanation": "The spread is best_ask - best_bid."
    }
  ]
}
```

### 15. flashcard

```json
{
  "id": "blk_xxxxx", "type": "flashcard", "status": "draft",
  "cards": [
    { "front": "What is a bid?", "back": "A buy order at a specific price.", "category": "basics" },
    { "front": "What is an ask?", "back": "A sell order at a specific price.", "category": "basics" }
  ]
}
```

### 16. summary

```json
{
  "id": "blk_xxxxx", "type": "summary", "status": "draft",
  "points": [
    "Order books show all buy and sell orders",
    "The spread is the gap between best bid and best ask",
    "Market makers profit from the spread"
  ]
}
```

### 17. embed

```json
{
  "id": "blk_xxxxx", "type": "embed", "status": "draft",
  "url": "https://example.com/interactive-demo",
  "title": "Interactive Order Book Demo",
  "description": "Try placing orders in a simulated market"
}
```

### 18. margin-annotation

```json
{
  "id": "blk_xxxxx", "type": "margin-annotation", "status": "draft",
  "text": "This concept connects to what we learned about supply and demand.",
  "author": "Claude"
}
```

### `sandbox` — runnable code cell

An editable, runnable code cell. Runs 100% client-side (nothing hits the server):
JavaScript/TypeScript in a Web Worker, Python via Pyodide (streamed from a CDN on
the first Python run). Works on mobile and offline.

```json
{
  "id": "blk_xxxxx", "type": "sandbox", "status": "published",
  "language": "python",                      // "javascript" | "typescript" | "python"
  "filename": "fair_value.py",               // optional label
  "code": "print('hi')",                     // starter code; use real \n newlines
  "expectedOutput": "hi",                    // optional: one stdout-equals check
  "tests": [                                  // optional checks, shown as PASS/FAIL
    { "name": "prints hi", "kind": "stdout-contains", "value": "hi" }
  ],
  "lockedRegions": [{ "fromLine": 1, "toLine": 2 }], // 1-indexed inclusive; runnable, not editable
  "autorun": false,                          // JS/TS only — never auto-boots Pyodide
  "timeoutMs": 0,                            // 0 = default (JS 3s, Python 10s)
  "readOnly": false, "hideEditor": false
}
```
Test `kind`: `stdout-contains` | `stdout-equals` | `no-error`. Prefer ≤40 starter
lines on mobile. (Raw CodeMirror 6 + own workers — do NOT swap in @uiw/react-codemirror
or @floating-ui; both are React-19 peer liabilities deliberately avoided.)

### `derivation` — step-by-step equation reveal

A proof/derivation revealed one line at a time (Next / Back). Each line is KaTeX
(`trust:false`); the changed term is shown as a Δ chip.

```json
{
  "id": "blk_xxxxx", "type": "derivation", "status": "published",
  "title": "Skewing quotes by inventory",
  "lines": [
    { "latex": "p = \\frac{a+b}{2}", "delta": null, "note": "Start from the [[mid-price]]." },
    { "latex": "p' = p - \\gamma q", "delta": "\\gamma q", "note": "Skew by inventory." }
  ],
  "caption": "One move at a time."
}
```
`delta` is the LaTeX of the changed sub-expression (not a character range). `note`,
`title`, `caption` are TextContent → `[[concepts]]` stay tappable.

### `scrolly-figure` — cinematic scrollytelling

A graphic that PINS while its stages cross-fade and step captions scroll past.
Stages are images (SVG preferred) the author drops under the book's content dir.

```json
{
  "id": "blk_xxxxx", "type": "scrolly-figure", "status": "published",
  "aspect": "4 / 5", "sticky": "center",
  "stages": [
    { "kind": "image", "src": "/content/<book>/fab-0.svg", "alt": "Ingot" },
    { "kind": "image", "src": "/content/<book>/fab-1.svg", "alt": "Wafer" }
  ],
  "steps": [
    { "stage": 0, "caption": "It starts as pure [[silicon]]." },
    { "stage": 1, "caption": "Sliced into wafers." }
  ],
  "caption": "From sand to chip."
}
```
2–6 stages; each `step.stage` indexes `stages[]`. Reduced-motion / no-JS falls back
to a plain stacked render. The graphic full-bleeds on phones.

## Outline (`outline.json`)

```json
{
  "_schema": 1,
  "bookId": "machine-learning",
  "chapters": [
    {
      "id": "01-linear-regression",
      "title": "Linear Regression",
      "concepts": ["regression", "least-squares", "gradient-descent"],
      "prereqs": [],
      "estimatedBlocks": 25,
      "status": "complete"
    }
  ],
  "conceptIndex": {
    "regression": {
      "definedIn": "01-linear-regression",
      "referencedIn": ["03-logistic-regression"],
      "prerequisites": []
    }
  }
}
```

## Block ID Format

`blk_` followed by 5 random lowercase alphanumeric characters: `blk_a3f9k`, `blk_7xm2p`

## Status

Blocks have `status: "draft"` or `status: "published"`. New AI-written content is always `draft`. Users approve blocks to publish them.
