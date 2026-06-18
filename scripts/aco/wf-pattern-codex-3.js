export const meta = {
  name: 'pattern-codex-slice-3',
  description: 'Finish Part II (Core Patterns) of The Pattern Codex: hashing/counting, recursion+backtracking, bit manipulation — self-verified research, then adversarial verify.',
  phases: [
    { title: 'Author', detail: 'research+verify, then write each chapter via the atheneum MCP' },
    { title: 'Verify', detail: 'adversarial check of correctness, schema, tone, no-fabrication' },
  ],
}

const SCHEMA = `
ATHENEUM BLOCK SCHEMA — obey EXACTLY or the strict write-gate rejects the chapter.
Author by calling mcp__atheneum__write_chapter {bookId:"pattern-codex", chapterId:<id>, chapter:{title, subtitle, number, estimatedReadMinutes, blocks:[...]}}.
First: ToolSearch "select:mcp__atheneum__get_chapter,mcp__atheneum__write_chapter,mcp__atheneum__validate_content,mcp__atheneum__update_blocks".
Every block: {"id":"blk_xxxxx","type":..,"status":"published", ...typefields}. IDs UNIQUE within chapter. status MUST be "published".
Types & FLAT fields (never nest under a sub-object):
- heading {level:2|3, text, anchor}
- text {text}  (inline markdown **bold** *italic* \`code\`, KaTeX $...$)
- callout {variant:"tip"|"warning"|"key-concept"|"example"|"definition"|"note", title, text, icon}
- code {language:"cpp", code, filename, showLineNumbers:true, highlightLines:[..], annotations:{"3":"note"}} (real \\n)
- list {style:"unordered"|"ordered", items:[{text},{text,children:[{text}]}]}
- table {headers:[..], rows:[[..]], caption}  (FLAT)
- math {expression, display:true}
- derivation {title, lines:[{latex, delta, note}], caption}
- flashcard {cards:[{front,back,category}]}  (FLAT)
- summary {points:[".."]}  (FLAT)
- sandbox {language:"python", code, filename, tests:[{name, kind:"stdout-contains", value}]} (NEVER c++; python demo with a printed trace; make SURE the trace actually prints the value your test checks)
- divider {style:"line"|"dots"|"flourish"}
Do NOT use figure/scrolly-figure blocks or reference image files. For the visual, use a 'table' or 'derivation' block.
After writing: mcp__atheneum__validate_content and FIX with update_blocks until valid:true.
`;

const TONE = `
VOICE — plain, example-first, readable when tired: characters as subjects + actions as verbs; define every term on first use; concrete worked example BEFORE the general rule; short active sentences; lead each section with its takeaway; cut throat-clearing; C++ snippets, one canonical clean correct form to memorize.
Before authoring, get_chapter "pattern-codex"/"04-two-pointers-and-sliding-window" AND "07-sorting-greedy-exchange" and mirror their structure/voice/density EXACTLY (note how 07 uses a 'table' as its mental-model visual).
`;

const TEMPLATE = `
SKELETON (same as ch04/ch07): (1) text: problem it kills + cost saved. (2) callout key-concept "The trigger". (3) heading "When to reach for it" + list of signals. (4) heading "The mental model" + a 'table' or 'derivation' visual + explanation. (5) heading "The snippet" + canonical C++ with line annotations + tip callout for the key insight. (6) heading "See it run" + a Python 'sandbox' with a printed trace + a stdout-contains test that MATCHES the trace. (7) heading "Worked example" + text + a C++ solution to a VERIFIED named problem. (8) heading "Tricks & brilliant catches" + list. (9) heading "Pitfalls" + warning callout + list. (10) heading "Flashcards" (5-6 cards). (11) heading "Drills" + text + list of VERIFIED problems (web-confirm IDs; or a Codeforces tag+rating filter; NEVER invent). (12) summary (6 points). ~30-34 blocks, cinema-grade.
`;

const CH09 = `
CHAPTER: id "09-hashing-frequency-counting", number 9, title "Hashing, Frequency & Counting".
Cover: when you need fast membership/lookup or to count occurrences, reach for a hash map / frequency array. The COMPLEMENT pattern (have x, look for target-x already seen) turns many O(n^2) pair problems into O(n). Frequency arrays beat hash maps when keys are small integers (faster, cache-friendly, no anti-hash risk). Counting with a running map: "number of subarrays/pairs with property P" via "count how many earlier prefixes/values satisfy the complement". multiset/map for ordered multiplicity. Snippet: two-sum-style complement scan with unordered_map (store value->index), and a small-key frequency-array variant. Worked example: a verified LeetCode problem (e.g., Group Anagrams via sorted-key map, or Two Sum). Tricks: frequency array vs hash map (small keys); the complement scan; canonical-form keys (sorted string for anagrams); reserve() + custom hash to dodge Codeforces anti-hash (or just use a sorted vector / gp_hash_table). Pitfalls: unordered_map worst-case O(n) hacking on Codeforces (mention custom hash or array); iterator invalidation while modifying; using map (adds log) when an array suffices; overflow in counts (long long).
RESEARCH: web-verify problem IDs. Candidates: LeetCode 1 Two Sum, 49 Group Anagrams, 242 Valid Anagram, 347 Top K Frequent Elements, 128 Longest Consecutive Sequence; Codeforces tag "hashing"/"data structures" rating 1300-1600. Avoid reusing LC 560 (it's in the prefix-sums chapter).
`;

const CH10 = `
CHAPTER: id "10-recursion-backtracking", number 10, title "Recursion, Backtracking & Pruning".
Cover: backtracking = build a candidate incrementally, and abandon a branch the moment it cannot lead to a valid/optimal solution (prune). The canonical shape: choose -> recurse -> un-choose (undo). Use it for permutations, subsets, combinations, and constraint puzzles (N-Queens, Sudoku, word search). Pruning is what turns exponential brute force into something that passes. Complexity is the size of the search tree, so n is small (<= ~ a few dozen with strong pruning, <= ~10-15 without). Snippet: the generic backtracking template (with a clear choose/recurse/unchoose), instantiated for subsets or permutations. Worked example: a verified problem (Subsets, Permutations, Combination Sum, or N-Queens) with the pruning made explicit. The mental-model visual should be a 'table' of the choose/recurse/unchoose steps OR a 'derivation' sketching the recursion tree. Tricks: prune early (check feasibility before recursing); fix order / used[] to avoid duplicate permutations; subsets via include/exclude OR via bitmask; pass state by reference and undo, don't copy. Pitfalls: forgetting to undo the choice (state leaks across branches); generating duplicates when input has equal elements (sort + skip); stack depth; copying the whole state each call (slow).
RESEARCH: web-verify IDs. Candidates: LeetCode 78 Subsets, 46 Permutations, 39 Combination Sum, 51 N-Queens, 79 Word Search, 90 Subsets II; Codeforces tag "brute force"/"dfs and similar" rating 1300-1600.
`;

const CH11 = `
CHAPTER: id "11-bit-manipulation", number 11, title "Bit Manipulation".
Cover: integers ARE sets of bits — and bit tricks give O(1) set ops and compact state. Core ops: test bit (x>>i&1), set (x|1<<i), clear (x & ~(1<<i)), toggle (x^1<<i), lowest set bit (x&-x), popcount (__builtin_popcount / popcountll), check power of two (x&&!(x&(x-1))). XOR tricks: a^a=0 so XOR of all finds the unique element; XOR pref"sum". Submask enumeration: for(int s=m; s; s=(s-1)&m) iterates all submasks of m in O(3^n) total over all masks. Subsets of an n-set via 0..2^n-1 bitmasks (n<=~20). Snippet: the essential ops as a tiny reference + submask enumeration loop. Worked example: a verified problem (Single Number via XOR, or Subsets via bitmask, or Counting Bits). The visual: a 'table' mapping each operation to its idiom and effect. Tricks: x&-x isolates the lowest set bit; iterate submasks with (s-1)&m; __builtin_ctz/clz for trailing/leading zeros; use 1LL<<i for masks beyond 31 bits (overflow!). Pitfalls: 1<<i overflows for i>=31 with int (use 1LL); signed shift UB; operator precedence (x & 1 == 0 is a classic bug -> parenthesize); __builtin_popcount takes unsigned int, use popcountll for 64-bit.
RESEARCH: web-verify IDs. Candidates: LeetCode 136 Single Number, 137 Single Number II, 260 Single Number III, 191 Number of 1 Bits, 338 Counting Bits, 78 Subsets (bitmask); Codeforces tag "bitmasks" rating 1300-1700.
`;

phase('Author');
const CHAPTERS = [
  { id: '09-hashing-frequency-counting', label: 'hash', brief: CH09 },
  { id: '10-recursion-backtracking', label: 'backtrack', brief: CH10 },
  { id: '11-bit-manipulation', label: 'bits', brief: CH11 },
];

const results = await pipeline(
  CHAPTERS,
  (ch) => agent(
    `You are an expert competitive-programming author writing one chapter of "The Pattern Codex" (bookId: pattern-codex), aimed at Codeforces 2000+.\n\n${SCHEMA}\n${TONE}\n${TEMPLATE}\n\nYOUR CHAPTER:\n${ch.brief}\n\nSTEPS: (1) RESEARCH: web-search to confirm algorithm details and VERIFY every practice-problem ID (open the page; if you cannot confirm, drop it and use a Codeforces tag+rating filter). (2) ToolSearch-load atheneum MCP tools; get_chapter exemplars 04 and 07; mirror format and voice. (3) Author and write_chapter; every C++ snippet must compile mentally and be correct; make the sandbox trace actually print what its test checks. (4) validate_content and fix until valid. Return ONLY: {"chapterId":"...","blockCount":N,"valid":true,"oneLineSummary":"..."}.`,
    { label: `author:${ch.label}`, phase: 'Author' }
  ),
  (authored, ch) => agent(
    `Adversarial reviewer for "The Pattern Codex" chapter (bookId pattern-codex, chapterId ${ch.id}). Author claims: ${authored}.\n\n${SCHEMA}\n\nLoad atheneum MCP tools, get_chapter the chapter, attack hard:\n1. CORRECTNESS: mentally compile+run every C++ snippet on small input; bit-ops/backtracking/hashing logic must be right; check the sandbox trace actually prints the string its stdout-contains test requires (a mismatch = a failing test = a bug to FIX). Fix wrong code via update_blocks.\n2. NO FABRICATION: every named problem must be REAL — web-verify any you doubt; replace unverifiable ones with a Codeforces tag+rating filter. No invented IDs/ratings.\n3. TONE: plain, example-first, short sentences, define-before-use, no throat-clearing; fix worst offenders.\n4. SCHEMA: validate_content and fix; confirm flat fields and status:"published".\nApply fixes directly. Return ONLY: {"chapterId":"${ch.id}","valid":<bool>,"fixesApplied":[".."],"remainingConcerns":[".."],"verdict":"ship"|"needs-lead-review"}.`,
    { label: `verify:${ch.label}`, phase: 'Verify' }
  )
);
return results;
