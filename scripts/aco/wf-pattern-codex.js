export const meta = {
  name: 'pattern-codex-slice',
  description: 'Author two marquee CP pattern chapters (binary search, prefix sums) for The Pattern Codex, grounded by verified research + live exemplars, then adversarially verify each.',
  phases: [
    { title: 'Author', detail: 'one agent per chapter writes it via the atheneum MCP' },
    { title: 'Verify', detail: 'adversarial check of correctness, schema, tone, no-fabrication' },
  ],
}

const SCHEMA = `
ATHENEUM BLOCK SCHEMA — obey EXACTLY or the strict write-gate rejects the chapter.
You author by calling the MCP tool mcp__atheneum__write_chapter with {bookId:"pattern-codex", chapterId:<id>, chapter:{title, subtitle, number, estimatedReadMinutes, blocks:[...]}}.
First load the tools you need with ToolSearch query "select:mcp__atheneum__get_chapter,mcp__atheneum__write_chapter,mcp__atheneum__validate_content,mcp__atheneum__update_blocks".

Every block: {"id":"blk_xxxxx","type":..,"status":"published", ...typefields}. IDs must be UNIQUE within the chapter (e.g. blk_bs01, blk_bs02 ...). status MUST be "published".
Block types and their FLAT fields (do NOT nest under a sub-object):
- heading: {level:2|3, text, anchor}
- text: {text}   // text supports inline markdown: **bold**, *italic*, \`code\`, and KaTeX in $...$
- callout: {variant:"tip"|"warning"|"key-concept"|"example"|"definition"|"note", title, text, icon}
- code: {language:"cpp", code, filename, showLineNumbers:true, highlightLines:[..], annotations:{"3":"note"}}  // code uses real \\n newlines
- list: {style:"unordered"|"ordered", items:[{text}, {text, children:[{text}]}]}
- table: {headers:[..], rows:[[..],[..]], caption}   // headers/rows FLAT on the block, NOT under a "table" key
- math: {expression, display:true}   // KaTeX
- derivation: {title, lines:[{latex, delta, note}], caption}   // step-by-step KaTeX reveal; delta is the LaTeX of the changed sub-expr or null
- flashcard: {cards:[{front, back, category}]}   // cards FLAT on the block
- summary: {points:[".."]}   // points FLAT on the block
- sandbox: {language:"python", code, filename, tests:[{name, kind:"stdout-contains", value}]}  // ONLY python/javascript/typescript run — NEVER c++. Use it for an interactive Python demo of the algorithm.
- divider: {style:"line"|"dots"|"flourish"}
Do NOT use a "figure"/"scrolly-figure" block (the lead will add SVGs separately). Do NOT reference image files.
After writing, call mcp__atheneum__validate_content {bookId:"pattern-codex", chapterId:<id>} and FIX any errors (use update_blocks) until it returns valid:true.
`;

const TONE = `
VOICE — plain, example-first, readable when tired. Rules (Williams/Pinker/plain-language):
1. Characters as subjects, actions as verbs. "the pointer advances", not "advancement occurs". No nominalizations.
2. Define every term on first use. Fight the curse of knowledge.
3. Concrete before abstract: a worked example with real numbers BEFORE the general formula.
4. Short sentences, active voice. One idea per paragraph.
5. Lead each section with its one-line takeaway (BLUF), then the details.
6. Cut throat-clearing ("it is important to note that"). Every sentence must help solve a problem faster.
7. Snippets are C++ (the reader codes C++). One canonical, clean, correct, fully-compiling form per idea — the thing to memorize.
Match the EXACT tone, density, and structure of the existing chapters. Before authoring, CALL get_chapter on "pattern-codex" / "04-two-pointers-and-sliding-window" AND "01-how-to-use-this-codex" and mirror them precisely.
`;

const TEMPLATE = `
CHAPTER SKELETON (same as chapter 04 — read it first):
1. text — open with the problem the pattern kills, and the cost it saves.
2. callout key-concept "The trigger" — the one-line tell.
3. heading "When to reach for it" + list of recognition signals.
4. heading "The mental model" + a visual block (use a 'derivation' or a 'table' since you cannot make SVGs) + explanation.
5. heading "The snippet" + the canonical C++ code block(s) with line annotations. Add a tip callout for the key insight.
6. heading "See it run" + a Python 'sandbox' that demonstrates the algorithm with a printed trace and a stdout-contains test.
7. heading "Worked example" + text + a C++ code solution to a named, verified problem.
8. heading "Tricks & brilliant catches" + list.
9. heading "Pitfalls" + a warning callout + list.
10. heading "Flashcards" + flashcard block (5-6 cards).
11. heading "Drills" + text + list of VERIFIED problems only (see brief). For Codeforces you may cite the verified IDs given, or give a "tag + rating range" filter — NEVER invent a problem ID or rating.
12. summary block (6 points).
Aim for ~28-34 blocks. Cinema-grade. This must make a serious competitor smile.
`;

const BS_BRIEF = `
CHAPTER: id "05-binary-search-on-the-answer", number 5, title "Binary Search on the Answer", subtitle of your choosing (crisp).
VERIFIED DEEP-DIVE (ground everything here; do not contradict it):
- One-line trigger: when asked for an optimal numeric value you can't compute directly but CAN cheaply check "is x achievable?" with a yes/no that flips exactly once as x grows, binary-search the answer.
- Signals: "minimize the maximum"/"maximize the minimum"; "smallest/largest x such that feasible(x)"; answer monotone in a parameter; huge answer range (up to 1e9+) but cheap O(n)/O(n log n) check; feasibility check is itself greedy or DP.
- Algorithm: define monotone feasible(x) (false..false true..true).
  Template A (invariant): keep f(lo)=false,f(hi)=true; while(hi-lo>1){mid=lo+(hi-lo)/2; feasible(mid)?hi=mid:lo=mid;} -> hi is smallest true.
  Template B (closed, min-feasible): while(lo<hi){mid=lo+(hi-lo)/2; if(feasible(mid)) hi=mid; else lo=mid+1;} -> lo==hi smallest feasible.
  Max-feasible: mid=lo+(hi-lo+1)/2 with lo=mid / hi=mid-1.
  Real-valued: fixed iteration count (~100 iters) beats an eps loop.
  Complexity O(log(range) * cost_of_check).
- Brilliant catches: (1) BS-on-answer + greedy/DP feasibility (Split Array Largest Sum, Aggressive Cows, Copying Books). (2) jump/binary-lifting form: for(b=hi;b>=1;b/=2) while(!ok(x+b)) x+=b; ans=x+1; (no mid-rounding bugs). (3) fixed-iteration real binary search dodges float instability; (advanced) parallel binary search.
- Pitfalls: overflow in mid=(lo+hi)/2 -> use lo+(hi-lo)/2; infinite loop in max-feasible form when mid rounds down and lo=mid never advances -> use mid=lo+(hi-lo+1)/2; predicate not actually monotone (BS invalid without strict false->true flip).
- VERIFIED problems (use only these / tag filters): LeetCode 875 Koko Eating Bananas (Med); LC 1011 Capacity To Ship Packages Within D Days (Med); LC 410 Split Array Largest Sum (Hard, BS+greedy); LC 1283 Find the Smallest Divisor Given a Threshold (Med); LC 1482 Minimum Number of Days to Make m Bouquets (Med); LC 4 Median of Two Sorted Arrays (Hard, BS the partition); SPOJ AGGRCOW "Aggressive cows" (maximize the minimum distance); SPOJ BOOKS1 / UVa 714 Copying Books. Codeforces: filter tag "binary search", rating 1500-1800; and Codeforces EDU "Binary search" (ITMO Academy pilot). Use Koko (875) or Aggressive Cows as the worked example.
For the mental model, a 'derivation' block stepping a number line false..false|true..true, or a 'table' showing feasible(x) flipping, works well.
`;

const PS_BRIEF = `
CHAPTER: id "06-prefix-sums-and-difference-arrays", number 6, title "Prefix Sums & Difference Arrays", subtitle of your choosing.
VERIFIED DEEP-DIVE:
- Trigger: many range-sum queries over a STATIC array -> prefix sum. Many range UPDATES then one final read ("add v to all of [l,r]" repeatedly) -> difference array.
- Signals: many sum(l,r)/submatrix-sum queries on unchanging data; repeated "add v to [l,r]" needing the array only after all updates -> 1D diff; 2D submatrix sum or rectangle add -> 2D prefix / 2D diff; counting that reduces to "how many prefixes satisfy X" (subarray sum = target, divisibility, equal 0/1) -> prefix + hashmap; interval load ("+1 at start, -1 at end") -> diff on endpoints.
- Algorithms (give correct C++):
  1D prefix (prefix[0]=0): prefix[k]=prefix[k-1]+a[k-1]; sum of a[l..r] (0-indexed inclusive) = prefix[r+1]-prefix[l]. O(n) build, O(1) query.
  1D difference: update [l,r]+=v via diff[l]+=v, diff[r+1]-=v; then prefix-sum diff to materialize. O(1)/update, O(n) finalize.
  2D prefix (1-indexed): P[i][j]=P[i-1][j]+P[i][j-1]-P[i-1][j-1]+a[i][j]; submatrix (r1..r2,c1..c2)=P[r2][c2]-P[r1-1][c2]-P[r2][c1-1]+P[r1-1][c1-1]. O(nm) build, O(1) query.
  2D difference (rectangle add, 4 corners): diff[r1][c1]+=v; diff[r2+1][c1]-=v; diff[r1][c2+1]-=v; diff[r2+1][c2+1]+=v; then 2D prefix to materialize.
- Brilliant catches: (1) prefix + hashmap for "subarray sum == K": keep count[prefix]; for each prefix s add count[s-K]; mapping 1->+1,0->-1 turns "longest equal #0s/#1s" into "two equal prefixes" (LC 525). (2) prefix sums mod m for divisibility: subarray sum divisible by K iff two prefixes share residue mod K (LC 974). (3) difference array as a sweep/event counter: each interval is +v at l, -v at r+1; one prefix pass gives value at every point (LC 1109).
- Pitfalls: off-by-one (pick ONE convention, keep prefix[0]=0); overflow (long long); r+1 / r2+1 / c2+1 boundary runs off the end (size arrays n+1 / m+1).
- VERIFIED problems: LC 303 Range Sum Query - Immutable (Easy); LC 304 Range Sum Query 2D - Immutable (Med); LC 560 Subarray Sum Equals K (Med); LC 974 Subarray Sums Divisible by K (Med); LC 525 Contiguous Array (Med); LC 1109 Corporate Flight Bookings (Med, 1D diff); LC 1314 Matrix Block Sum (Med); LC 2536 Increment Submatrices by One (Med, 2D diff); CSES 1652 Forest Queries (2D prefix); CSES 1661 Subarray Sums II (prefix + hashmap); Codeforces 816B "Karen and Coffee" (difference array, Div2 B). Codeforces filter: prefix-sum/difference-array style, rating ~1200-1600. Use LC 560 (prefix+hashmap) or LC 304 (2D prefix) as the worked example; the 2D prefix inclusion-exclusion formula is a great 'table' or 'derivation' visual.
`;

phase('Author');

const CHAPTERS = [
  { id: '05-binary-search-on-the-answer', label: 'bs', brief: BS_BRIEF },
  { id: '06-prefix-sums-and-difference-arrays', label: 'ps', brief: PS_BRIEF },
];

const results = await pipeline(
  CHAPTERS,
  // STAGE 1 — author the chapter via MCP
  (ch) => agent(
    `You are an expert competitive-programming author writing one chapter of "The Pattern Codex" (bookId: pattern-codex), a CP mastery book aimed at Codeforces 2000+.\n\n${SCHEMA}\n${TONE}\n${TEMPLATE}\n\nYOUR CHAPTER:\n${ch.brief}\n\nSTEPS: (1) ToolSearch-load the atheneum MCP tools. (2) get_chapter the exemplars 04-two-pointers-and-sliding-window and 01-how-to-use-this-codex and study their exact format/voice. (3) Author your chapter and write it with write_chapter. (4) validate_content and fix until valid. Every C++ snippet must be correct and compile mentally. Return ONLY a compact JSON line: {"chapterId":"...","blockCount":N,"valid":true,"oneLineSummary":"..."}.`,
    { label: `author:${ch.label}`, phase: 'Author' }
  ),
  // STAGE 2 — adversarial verify + self-heal
  (authored, ch) => agent(
    `You are an adversarial reviewer for one chapter of "The Pattern Codex" (bookId: pattern-codex, chapterId: ${ch.id}). The author claims: ${authored}.\n\n${SCHEMA}\n\nLoad the atheneum MCP tools, get_chapter the chapter, and attack it hard on these axes:\n1. CORRECTNESS: mentally compile and RUN every C++ snippet on a small input. Binary-search loops must terminate and not overflow (mid=lo+(hi-lo)/2). Prefix/diff index math must be exactly right (off-by-one). If any code is wrong, FIX it via update_blocks.\n2. NO FABRICATION: every named practice problem must be a REAL problem from the verified list in the brief below, or a "tag+rating range" filter — NO invented IDs/ratings. Remove or correct any that aren't verified.\nVERIFIED LIST FOR THIS CHAPTER:\n${ch.brief}\n3. TONE: plain, example-first, short sentences, define-before-use, no throat-clearing. Fix the worst offenders via update_blocks.\n4. SCHEMA: run validate_content; fix any errors. Confirm flat fields (table headers/rows flat, summary points flat, flashcard cards flat), status:"published".\nApply fixes directly. Then return ONLY a compact JSON line: {"chapterId":"${ch.id}","valid":<bool>,"fixesApplied":[".."],"remainingConcerns":[".."],"verdict":"ship"|"needs-lead-review"}.`,
    { label: `verify:${ch.label}`, phase: 'Verify' }
  )
);

return results;
