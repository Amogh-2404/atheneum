import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import path from 'path'
import { safeReadJSON } from './lib/file-ops.js'

export function registerPrompts(server: McpServer, contentDir: string) {

  // ─── teach_chapter ───────────────────────────────────────────────
  server.prompt(
    'teach_chapter',
    'Generate a chapter following Atheneum teaching methodology — dual coding, concrete-before-abstract, progressive complexity.',
    {
      bookId: z.string().describe('Which book this chapter belongs to'),
      topic: z.string().describe('What the chapter should teach'),
      chapterId: z.string().optional().describe('Chapter ID (e.g., "02-market-making"). Auto-generated if omitted.'),
      prerequisites: z.string().optional().describe('Comma-separated concepts the reader already knows'),
      targetBlocks: z.number().optional().describe('Approximate number of blocks (default: 25)'),
    },
    async ({ bookId, topic, chapterId, prerequisites, targetBlocks }) => {
      // Load current outline for context
      const outline = await safeReadJSON(path.join(contentDir, bookId, 'outline.json'))
      const outlineContext = outline
        ? `\n\nCurrent book outline:\n${JSON.stringify(outline, null, 2)}`
        : '\n\nNo outline found — this may be the first chapter.'

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `You are writing a chapter for Atheneum — an AI-native textbook platform.

## Teaching Methodology

Every chapter MUST follow this structure:

1. **Opening Hook** — A \`text\` block with a relatable scenario or question that hooks the reader
2. **Chapter Heading** — \`heading\` level 1 with the chapter title
3. **Why This Matters** — \`callout\` (variant: "key-concept") explaining relevance
4. **Concepts Section** — For each concept:
   - \`heading\` level 2
   - \`text\` block with concrete example FIRST (before the definition)
   - \`callout\` (variant: "definition") with the formal definition
   - \`diagram\`, \`figure\`, or \`table\` for visual representation (EVERY concept needs a visual — dual coding)
   - \`quiz\` block to test understanding of this specific concept
5. **Worked Examples** — \`code\` blocks with annotations, or \`callout\` (variant: "example")
6. **Common Pitfalls** — \`callout\` (variant: "warning")
7. **Practice Problems** — \`toggle\` blocks (answer hidden inside)
8. **Chapter Summary** — \`summary\` block with key takeaways
9. **Flashcards** — \`flashcard\` block for spaced repetition

## Writing Rules

- **Concrete examples BEFORE abstract definitions** — show the thing, then name it
- **Dual coding**: Every concept gets BOTH text AND a visual (diagram, figure, table)
- **Use [[concept]] references** to link to defined concepts
- **Keep blocks focused** — one idea per block, max 4-5 sentences per text block
- **Add quiz blocks** after every major concept (not just at chapter end)
- **Block IDs**: format \`blk_\` followed by 5 random alphanumeric chars
- **All new content**: status: "draft"
- **Calculate estimatedReadMinutes** — roughly 200 words per minute
- **Update blockCount** to match actual number of blocks

## TextContent Format
Plain string with **bold**, *italic*, \`code\`, [[concept]], [link](url)
OR RichText array: [{ text: "normal" }, { text: "bold", annotations: { bold: true } }]

## Available Block Types
heading, text, callout, code, diagram, figure, quote, list, divider, math, table, toggle, timeline, quiz, flashcard, summary, embed, margin-annotation

## After Writing
Use the \`write_chapter\` tool to save the chapter, then \`update_outline\` to add it to the book outline.

---

## Your Task

Write a chapter about: **${topic}**
Book: ${bookId}
${chapterId ? `Chapter ID: ${chapterId}` : 'Generate an appropriate chapter ID (format: NN-slug)'}
${prerequisites ? `Prerequisites the reader knows: ${prerequisites}` : 'No specific prerequisites stated.'}
Target length: ~${targetBlocks ?? 25} blocks
${outlineContext}

Write the complete chapter JSON and use write_chapter to save it.`,
            },
          },
        ],
      }
    }
  )

  // ─── improve_chapter ─────────────────────────────────────────────
  server.prompt(
    'improve_chapter',
    'Review and improve an existing chapter based on confusion markers and quality standards. Pass targetBlockId to surgically rewrite ONE flagged block instead of the whole chapter.',
    {
      bookId: z.string(),
      chapterId: z.string(),
      focusAreas: z.string().optional().describe('Specific areas: clarity, examples, interactivity, flow'),
      targetBlockId: z.string().optional().describe('Restrict the rewrite to this single block id — emits ONE draft replacement instead of touching the whole chapter'),
    },
    async ({ bookId, chapterId, focusAreas, targetBlockId }) => {
      const chapter = await safeReadJSON(path.join(contentDir, bookId, 'chapters', `${chapterId}.json`))
      const annoData = await safeReadJSON(path.join(contentDir, bookId, '.annotations', 'annotations.json'))
      let confusionMarkers = (annoData?.annotations ?? []).filter((a: any) => a.type === 'confusion')

      // ── Surgical (single-block) mode ────────────────────────────────
      if (targetBlockId) {
        const targetBlock = chapter?.blocks?.find((b: any) => b.id === targetBlockId)
        // Narrow the confusion context to markers on THIS block only.
        confusionMarkers = confusionMarkers.filter((a: any) => a.blockId === targetBlockId)

        const targetContext = targetBlock
          ? JSON.stringify(targetBlock, null, 2)
          : `Block "${targetBlockId}" not found in this chapter — re-check the blockId.`

        const confusionContext = confusionMarkers.length > 0
          ? `\n\n## Reader Confusion on this block (${confusionMarkers.length})\n${JSON.stringify(confusionMarkers, null, 2)}`
          : '\n\nNo confusion marker is recorded specifically for this block — improve it for clarity anyway.'

        return {
          messages: [
            {
              role: 'user' as const,
              content: {
                type: 'text' as const,
                text: `Surgically improve ONE block of this Atheneum chapter. Do NOT rewrite or touch any other block.

## Scope
- Book: ${bookId}
- Chapter: ${chapterId}
- Target block id: **${targetBlockId}**

## Why
A reader flagged this specific block as confusing. First, confirm the signal by calling the \`get_confusion_markers\` tool for this book and reading the markers whose \`blockId\` is "${targetBlockId}". Then produce a single, clearer replacement for ONLY that block.

## How to emit the rewrite (REQUIRED)
1. Call \`insert_blocks\` with \`afterBlockId: "${targetBlockId}"\` and a single new block in the \`blocks\` array.
2. Leave \`status\` at its default ("draft") — the new block MUST be a draft so the reader can review it.
3. Keep the SAME block \`type\` as the original (a confusing text block stays a text block, etc.) unless the confusion is clearly that the wrong block type was used.
4. The new block is inserted directly after the original; the reader UI links them via \`metadata.insertedAfter\` and shows an old-vs-new diff with Keep / Revert. Do NOT delete or edit the original block — the reviewer decides its fate.

## Quality bar for the replacement
- Fix the specific confusion: simpler wording, a concrete example before any abstraction, a worked step, or a missing definition.
- One idea, max 4-5 sentences if it's a text block.
- Proper LaTeX for math, language + meaningful annotations for code, [[concept]] links intact.

${focusAreas ? `## Focus Areas: ${focusAreas}` : ''}
${confusionContext}

## The block to replace
${targetContext}`,
              },
            },
          ],
        }
      }

      // ── Whole-chapter mode (unchanged behaviour) ────────────────────
      const chapterContext = chapter
        ? JSON.stringify(chapter, null, 2)
        : 'Chapter not found — check the bookId and chapterId.'

      const confusionContext = confusionMarkers.length > 0
        ? `\n\n## Confusion Markers (${confusionMarkers.length} sections flagged by the reader)\n${JSON.stringify(confusionMarkers, null, 2)}`
        : '\n\nNo confusion markers — general quality improvement.'

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Review and improve this Atheneum chapter. First call the \`get_confusion_markers\` tool for this book to see exactly what the reader flagged. Use \`update_blocks\` for surgical edits — don't rewrite the entire chapter unless necessary.

## Quality Checklist
- [ ] Every concept has both text AND visual (dual coding)
- [ ] Concrete examples come BEFORE abstract definitions
- [ ] Quiz after each major concept, not just at chapter end
- [ ] No text block longer than 4-5 sentences
- [ ] All [[concept]] references resolve to defined concepts
- [ ] Math expressions use proper LaTeX (KaTeX compatible)
- [ ] Code blocks have language set and meaningful annotations
- [ ] Tables used for tabular data (not crammed into text)
- [ ] Callout variants match content (definition, warning, tip, etc.)

${focusAreas ? `## Focus Areas: ${focusAreas}` : ''}
${confusionContext}

## Current Chapter Content
${chapterContext}`,
            },
          },
        ],
      }
    }
  )

  // ─── review_content ──────────────────────────────────────────────
  server.prompt(
    'review_content',
    'Review a chapter for quality, accuracy, and pedagogical effectiveness. Outputs a structured assessment.',
    {
      bookId: z.string(),
      chapterId: z.string(),
    },
    async ({ bookId, chapterId }) => {
      const chapter = await safeReadJSON(path.join(contentDir, bookId, 'chapters', `${chapterId}.json`))

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Review this Atheneum chapter and provide a structured assessment. Do NOT make changes — only evaluate.

## Review Rubric (score each 1-5)

1. **Accuracy** — Is the content correct? Any factual errors?
2. **Clarity** — Can a beginner understand it? Is jargon defined before use?
3. **Structure** — Does it follow the chapter template? (Hook → Concepts → Examples → Practice → Summary)
4. **Interactivity** — Are there quizzes after concepts? Toggle practice problems? Flashcards?
5. **Visual Richness** — Does every concept have a visual? (diagram, table, figure, code)
6. **Concept Ordering** — Are prerequisites taught before dependent concepts?
7. **Block Quality** — Are blocks focused (one idea each)? No run-on text blocks?

## Output Format
For each rubric item: score, specific feedback, and block IDs that need attention.
End with: overall score, top 3 improvements to make, and whether to use update_blocks or rewrite.

## Chapter Content
${chapter ? JSON.stringify(chapter, null, 2) : 'Chapter not found.'}`,
            },
          },
        ],
      }
    }
  )

  // ─── plan_book ───────────────────────────────────────────────────
  server.prompt(
    'plan_book',
    'Design a book outline with proper concept ordering and prerequisites.',
    {
      topic: z.string().describe('The subject area for the book'),
      audience: z.string().optional().describe('Target audience (beginner, intermediate, expert)'),
      scope: z.string().optional().describe('What to include/exclude'),
    },
    async ({ topic, audience, scope }) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Design a Atheneum book outline for: **${topic}**

${audience ? `Target audience: ${audience}` : 'Audience: assume intermediate background'}
${scope ? `Scope: ${scope}` : ''}

## Guidelines

1. **Concept graph first** — identify all concepts, then order by prerequisites
2. **Each chapter** should teach 3-5 concepts max
3. **Progressive complexity** — foundational → intermediate → advanced
4. **Each chapter entry** needs: id (slug), title, concepts[], prereqs[], estimatedBlocks
5. **Concept index** — map each concept to its definition location and references

## Output Format

Produce a complete outline JSON suitable for the \`update_outline\` tool:
\`\`\`json
{
  "chapters": [
    { "id": "01-slug", "title": "...", "concepts": [...], "prereqs": [...], "estimatedBlocks": 25, "status": "planned" }
  ],
  "conceptIndex": {
    "concept-name": { "definedIn": "01-slug", "referencedIn": ["02-slug"], "prerequisites": ["other-concept"] }
  }
}
\`\`\`

After approval, use \`create_book\` to scaffold the book, then \`update_outline\` to save this outline.`,
            },
          },
        ],
      }
    }
  )
}
