export const meta = {
  name: 'pattern-codex-slice-2',
  description: 'Author two more Core Pattern chapters (greedy/exchange, monotonic stack & queue) for The Pattern Codex with self-verified research, then adversarially verify each.',
  phases: [
    { title: 'Author', detail: 'research+verify, then write each chapter via the atheneum MCP' },
    { title: 'Verify', detail: 'adversarial check of correctness, schema, tone, no-fabrication' },
  ],
}

const SCHEMA = `
ATHENEUM BLOCK SCHEMA — obey EXACTLY or the strict write-gate rejects the chapter.
Author by calling mcp__atheneum__write_chapter with {bookId:"pattern-codex", chapterId:<id>, chapter:{title, subtitle, number, estimatedReadMinutes, blocks:[...]}}.
First: ToolSearch "select:mcp__atheneum__get_chapter,mcp__atheneum__write_chapter,mcp__atheneum__validate_content,mcp__atheneum__update_blocks".
Every block: {"id":"blk_xxxxx","type":..,"status":"published", ...typefields}. IDs UNIQUE within the chapter. status MUST be "published".
Types & FLAT fields (never nest under a sub-object):
- heading {level:2|3, text, anchor}
- text {text}  (inline markdown: **bold**, *italic*, \`code\`, KaTeX $...$)
- callout {variant:"tip"|"warning"|"key-concept"|"example"|"definition"|"note", title, text, icon}
- code {language:"cpp", code, filename, showLineNumbers:true, highlightLines:[..], annotations:{"3":"note"}}  (real \\n)
- list {style:"unordered"|"ordered", items:[{text}, {text, children:[{text}]}]}
- table {headers:[..], rows:[[..]], caption}   (headers/rows FLAT)
- math {expression, display:true}
- derivation {title, lines:[{latex, delta, note}], caption}
- flashcard {cards:[{front, back, category}]}   (cards FLAT)
- summary {points:[".."]}   (points FLAT)
- sandbox {language:"python", code, filename, tests:[{name, kind:"stdout-contains", value}]}  (NEVER c++; python demo)
- divider {style:"line"|"dots"|"flourish"}
Do NOT use figure/scrolly-figure blocks or reference image files (the lead adds SVGs separately).
After writing: mcp__atheneum__validate_content and FIX with update_blocks until valid:true.
`;

const TONE = `
VOICE — plain, example-first, readable when tired (Williams/Pinker/plain-language):
characters as subjects + actions as verbs; define every term on first use; concrete worked example BEFORE the general rule; short active sentences, one idea per paragraph; lead each section with its takeaway; cut throat-clearing; C++ snippets, one canonical clean correct form to memorize.
Before authoring, get_chapter "pattern-codex"/"04-two-pointers-and-sliding-window" and mirror its structure/voice/density EXACTLY.
`;

const TEMPLATE = `
SKELETON (same as chapter 04): (1) text: the problem it kills + cost saved. (2) callout key-concept "The trigger". (3) heading "When to reach for it" + list of signals. (4) heading "The mental model" + a 'derivation' or 'table' visual + explanation. (5) heading "The snippet" + canonical C++ code with line annotations + a tip callout for the key insight. (6) heading "See it run" + a Python 'sandbox' with a printed trace + stdout-contains test. (7) heading "Worked example" + text + a C++ solution to a VERIFIED named problem. (8) heading "Tricks & brilliant catches" + list. (9) heading "Pitfalls" + warning callout + list. (10) heading "Flashcards" + flashcard (5-6 cards). (11) heading "Drills" + text + list of VERIFIED problems (web-confirm IDs; or give a Codeforces tag+rating filter; NEVER invent an ID/rating). (12) summary (6 points). ~30-34 blocks, cinema-grade.
`;

const CH07 = `
CHAPTER: id "07-sorting-greedy-exchange", number 7, title "Sorting, Greedy & Exchange Arguments".
Cover: greedy = a locally-optimal choice that provably yields a global optimum, almost always AFTER sorting by the right key — "sort by what?" is the whole game. The EXCHANGE ARGUMENT is the proof technique: assume an optimal solution differs from greedy, swap two adjacent items toward greedy's order without making it worse, conclude greedy is optimal. Cover classic wins: interval scheduling / activity selection (sort by END time), minimize total waiting time (sort by duration / SPT), fractional knapsack (sort by value/weight ratio), pairing two arrays. Stress WHEN GREEDY FAILS (0/1 knapsack needs DP; coin change with arbitrary denominations) and that you must either prove it (exchange) or find a counterexample before trusting it. Snippet: interval scheduling (sort by end, take if start >= last_end). Worked example: a verified interval problem. Tricks: sort-by-end for max non-overlapping; sort-by-ratio for fractional; the adjacent-swap proof; custom comparator pitfalls (strict weak ordering). Pitfalls: assuming greedy works without proof; comparator that isn't a strict weak ordering (UB); overflow; ties.
RESEARCH FIRST: web-verify every practice problem ID before listing it. Strong candidates to verify: LeetCode 455 Assign Cookies, 56 Merge Intervals, 435 Non-overlapping Intervals, 452 Minimum Number of Arrows to Burst Balloons, 621 Task Scheduler; Codeforces tag "greedy" rating 1300-1600. Only list what you verify; otherwise use a tag+rating filter.
`;

const CH08 = `
CHAPTER: id "08-monotonic-stack-and-queue", number 8, title "Monotonic Stack & Queue".
Cover: monotonic stack answers "next/previous greater/smaller element" and "largest rectangle in histogram" in O(n) — keep a stack whose values are monotone; before pushing, pop everything it dominates; each index is pushed and popped once. Monotonic DEQUE answers sliding-window max/min in O(n) — push at back popping dominated elements, pop stale indices from the front, the front is the extremum. Snippet: next-greater-element with a decreasing stack (store INDICES). Worked example: a verified problem (Daily Temperatures or Largest Rectangle in Histogram). Tricks: store indices not values; the amortized push-once/pop-once O(n) argument; strict vs non-strict comparison decides how duplicates are handled; largest-rectangle uses a sentinel/while-pop to flush. Pitfalls: off-by-one in window eviction (deque front index <= r-k); wrong comparison for duplicates; forgetting to flush the stack at the end.
RESEARCH FIRST: web-verify every practice problem ID. Strong candidates: LeetCode 496 Next Greater Element I, 503 Next Greater Element II, 739 Daily Temperatures, 84 Largest Rectangle in Histogram, 239 Sliding Window Maximum, 42 Trapping Rain Water; Codeforces tag "data structures"/"two pointers" appropriate ratings. Only list verified; else a tag filter.
`;

phase('Author');
const CHAPTERS = [
  { id: '07-sorting-greedy-exchange', label: 'greedy', brief: CH07 },
  { id: '08-monotonic-stack-and-queue', label: 'monostack', brief: CH08 },
];

const results = await pipeline(
  CHAPTERS,
  (ch) => agent(
    `You are an expert competitive-programming author writing one chapter of "The Pattern Codex" (bookId: pattern-codex), aimed at Codeforces 2000+.\n\n${SCHEMA}\n${TONE}\n${TEMPLATE}\n\nYOUR CHAPTER:\n${ch.brief}\n\nSTEPS: (1) RESEARCH: web-search to confirm the algorithm details and to VERIFY every practice-problem ID you intend to cite (open the problem page; if you cannot confirm, drop it and use a Codeforces tag+rating filter instead). (2) ToolSearch-load the atheneum MCP tools and get_chapter the exemplar 04-two-pointers-and-sliding-window; mirror its format and voice. (3) Author and write the chapter with write_chapter; every C++ snippet must compile mentally and be correct. (4) validate_content and fix until valid. Return ONLY: {"chapterId":"...","blockCount":N,"valid":true,"oneLineSummary":"..."}.`,
    { label: `author:${ch.label}`, phase: 'Author' }
  ),
  (authored, ch) => agent(
    `Adversarial reviewer for "The Pattern Codex" chapter (bookId pattern-codex, chapterId ${ch.id}). Author claims: ${authored}.\n\n${SCHEMA}\n\nLoad atheneum MCP tools, get_chapter the chapter, attack hard:\n1. CORRECTNESS: mentally compile+run every C++ snippet on a small input; monotonic-stack/greedy logic must be right and O(n)/O(n log n) as claimed; fix wrong code via update_blocks.\n2. NO FABRICATION: every named problem must be REAL — web-verify any you doubt; replace unverifiable ones with a Codeforces tag+rating filter. No invented IDs/ratings.\n3. TONE: plain, example-first, short sentences, define-before-use, no throat-clearing; fix worst offenders.\n4. SCHEMA: validate_content and fix; confirm flat fields and status:"published".\nApply fixes directly. Return ONLY: {"chapterId":"${ch.id}","valid":<bool>,"fixesApplied":[".."],"remainingConcerns":[".."],"verdict":"ship"|"needs-lead-review"}.`,
    { label: `verify:${ch.label}`, phase: 'Verify' }
  )
);
return results;
