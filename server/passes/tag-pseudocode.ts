/* ─── Pass: TagPseudocode ────────────────────────────────────────────────────
   Detects untagged code blocks that are *intentional pseudocode* — English
   flow control (`if/else/while/for/return/function`) without a real
   programming language signature — and tags them `language='pseudocode'`.

   The renderer + PDF backend use that tag to:
     - drop syntax highlighting (no false coloring of "x_1" identifiers)
     - render in a slightly larger monospace + a `pseudocode` callout border
     - emit `\begin{pseudocode}` in TikZ for academic-style print rendering

   Detection criteria:
     - Has English flow-control keywords (if/else/while/for/return/function/def)
       AND lacks programming-language signatures (FixCodeLanguage low-conf)
     - OR uses Unicode math (∅ ≥ ≤ ⊤ ⊥ ∈ ∀ ∃) which is the academic
       pseudocode tell
     - OR uses BNF/grammar syntax (`::=` and `|` separators)
───────────────────────────────────────────────────────────────────────────── */

import type { Block } from '../../src/types/blocks.ts'
import type { BlockPass, BlockPassContext } from './types.ts'
import { detectLanguage } from './fix-code-language.ts'

const FLOW_CONTROL_RE = /\b(?:if|else|elif|while|for|return|function|def|procedure|begin|end|repeat|until|do)\b/i
const MATH_UNICODE_RE = /[∅≥≤⊤⊥∈∀∃∑∏∇∂±√⊕⊗→←↔]/
const BNF_RE = /::=|→|\|\s*\w+/

export function isPseudocode(code: string): boolean {
  const s = code.trim()
  if (s.length < 20 || s.split('\n').length < 2) return false

  // First eliminate: does the language detector see this as a real language?
  const det = detectLanguage(s)
  if (det.confidence === 'high' && det.lang !== 'text') return false

  // Three positive signals (any one suffices)
  if (FLOW_CONTROL_RE.test(s)) return true
  if (MATH_UNICODE_RE.test(s)) return true
  if (BNF_RE.test(s) && /\w+\s*::=/.test(s)) return true

  return false
}

export const TagPseudocodePass: BlockPass = {
  name: 'TagPseudocode',
  describe: 'Tag English-flow-control code blocks as language="pseudocode".',
  run(b: Block, _ctx: BlockPassContext) {
    if (b.type !== 'code') return { block: b, changed: false }
    const cur = (b.language ?? '').toLowerCase().trim()
    if (cur !== '' && cur !== 'text' && cur !== 'txt') return { block: b, changed: false }
    if (!isPseudocode(b.code ?? '')) return { block: b, changed: false }

    const next: Block = { ...b, language: 'pseudocode' }
    return {
      block: next,
      changed: true,
      notes: [{
        severity: 'info',
        code: 'PSEUDO_TAGGED',
        msg: 'Tagged as pseudocode — flow-control or math-unicode signature.',
        blockId: b.id,
      }],
    }
  },
}
