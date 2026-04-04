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
