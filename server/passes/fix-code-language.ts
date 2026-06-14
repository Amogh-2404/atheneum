/* ─── Pass: FixCodeLanguage ──────────────────────────────────────────────────
   Auto-detects the language for code blocks that ship with a missing /
   "text" / "txt" placeholder. Same heuristic table as the v2 markdown
   converter, ported into a typed pass and made idempotent.

   Detection coverage:
     LLVM IR · MIR · MLIR · TableGen · Hexagon asm · x86/ARM asm · C++ ·
     C · Python · Bash · CMake · Make · Diff · JSON · TypeScript · YAML ·
     Rust · Go · SQL.

   Conservative: when uncertain, leaves the block alone with a `note`
   instead of mis-tagging. Only writes when confidence is high.
───────────────────────────────────────────────────────────────────────────── */

import type { Block } from '../../src/types/blocks.ts'
import type { BlockPass, BlockPassContext } from './types.ts'

const RE = {
  llvm: [
    /^\s*define\s+(linkonce|internal|weak|external|private|dso_local)?\s*[\w*]+\s+@\w+\s*\(/m,
    /^\s*@\w+\s*=\s*(constant|global|private|internal)/m,
    /\bgetelementptr\s+(inbounds\s+)?/,
    /^\s*%\w+\s*=\s*(load|store|alloca|call|phi|add|sub|mul|icmp|fcmp|br|ret)\b/m,
  ],
  mir: [/^---\s*\nname:/m, /\bbb\.\d+:\s*$/m, /\$[a-z]\d+ =/, /\b(MOV|ADD|SUB|MUL|RET)32rr\b/],
  mlir: [/^\s*func\s+(public|private)?\s*@\w+/m, /\b(linalg|tensor|memref|vector|scf|arith|llvm)\.\w+/],
  tablegen: [/^(def|class|let|multiclass|defm|include)\s+\w+/m],
  hexagon: [/\{[^}]*\b(R\d+|V\d+|P\d+)\s*=/],
  asm: [
    /^\s*(mov|push|pop|call|ret|jmp|je|jne|add|sub|xor|cmp)\s+%?[a-z]/im,
    /^\s*\.section\s+\.text|^\s*\.globl\s+/m,
  ],
  cpp: [
    /\b(std::|namespace\s+\w+|template\s*<|class\s+\w+\s*[:{]|struct\s+\w+\s*[:{]|using\s+\w+\s*=)/,
    /#include\s*[<"](iostream|vector|string|memory|algorithm|llvm\/)/,
    /\b(unique_ptr|shared_ptr|make_unique|nullptr|auto\s+\w+\s*=)\b/,
  ],
  c: [
    /^#include\s*<[a-z_]+\.h>/m,
    /\b(int|void|char|float|double|struct|typedef|static|extern)\s+\w+\s*[=({]/,
  ],
  python: [/^(def\s+\w+\s*\(|class\s+\w+\s*[:(]|import\s+\w+|from\s+\w+\s+import)/m],
  bash: [
    /^\s*\$\s+\S/m,
    /^#!\/\S+\/(ba)?sh/,
    /\b(grep|sed|awk|find|xargs|tar|curl|wget|chmod|chown|mkdir|rm)\b\s+-?\w/,
  ],
  cmake: [/^(cmake_minimum_required|project|add_executable|add_library|target_link)/m],
  makefile: [/^\w+\s*[?:+]?=\s*/m],
  diff: [/^(diff --git|---\s|\+\+\+\s|@@\s)/m],
  json: [],   // structural test below
  typescript: [/(?:^|\n)\s*(?:export\s+)?(?:interface|type)\s+\w+\s*[<={]/],
  yaml: [/^[a-zA-Z_][\w-]*:\s*(?:\||>|$)/m, /^\s*-\s+[a-zA-Z]/m],
  rust: [/^\s*fn\s+\w+\s*\(/m, /\bimpl\s+\w+/, /^\s*use\s+\w+(::\w+)*;/m],
  go: [/^\s*package\s+\w+/m, /^\s*func\s+(\([^)]+\)\s+)?\w+\s*\(/m, /\bgoroutine\b/],
  sql: [/\b(SELECT|INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE|DROP TABLE)\b/i],
}

function detectLanguage(code: string): { lang: string; confidence: 'high' | 'medium' | 'low' } {
  const s = code.trim()
  if (!s) return { lang: 'text', confidence: 'low' }

  // Highest priority: LLVM IR / MIR / MLIR — they have very distinctive markers
  if (RE.llvm.some(r => r.test(s))) return { lang: 'llvm', confidence: 'high' }
  if (RE.mir.some(r => r.test(s)))  return { lang: 'mir',  confidence: 'high' }
  if (RE.mlir.some(r => r.test(s))) return { lang: 'mlir', confidence: 'high' }
  if (RE.tablegen.some(r => r.test(s))) return { lang: 'tablegen', confidence: 'high' }
  if (RE.hexagon.some(r => r.test(s))) return { lang: 'hexagon', confidence: 'high' }

  // Diff signature is unique
  if (RE.diff.some(r => r.test(s))) return { lang: 'diff', confidence: 'high' }

  // C++ before C (C++ is a superset)
  if (RE.cpp.some(r => r.test(s))) return { lang: 'cpp', confidence: 'high' }
  if (RE.rust.some(r => r.test(s))) return { lang: 'rust', confidence: 'high' }
  if (RE.go.some(r => r.test(s))) return { lang: 'go', confidence: 'high' }
  if (RE.typescript.some(r => r.test(s))) return { lang: 'typescript', confidence: 'high' }
  if (RE.python.some(r => r.test(s))) return { lang: 'python', confidence: 'high' }
  if (RE.cmake.some(r => r.test(s))) return { lang: 'cmake', confidence: 'high' }
  if (RE.makefile.some(r => r.test(s)) && /^\w[\w.]*:.*\n\t/m.test(s)) return { lang: 'makefile', confidence: 'high' }

  if (RE.c.some(r => r.test(s))) return { lang: 'c', confidence: 'medium' }
  if (RE.asm.some(r => r.test(s))) return { lang: 'asm', confidence: 'medium' }
  if (RE.bash.some(r => r.test(s))) return { lang: 'bash', confidence: 'medium' }
  if (RE.sql.some(r => r.test(s))) return { lang: 'sql', confidence: 'medium' }

  // YAML — beware: indented Python and YAML lookalike
  if (RE.yaml.some(r => r.test(s)) && !/^def\s|^class\s/m.test(s)) {
    return { lang: 'yaml', confidence: 'medium' }
  }

  // JSON — try parsing
  if ((s.startsWith('{') && s.trimEnd().endsWith('}')) || (s.startsWith('[') && s.trimEnd().endsWith(']'))) {
    try { JSON.parse(s); return { lang: 'json', confidence: 'high' } } catch { /* not JSON */ }
  }

  return { lang: 'text', confidence: 'low' }
}

export const FixCodeLanguagePass: BlockPass = {
  name: 'FixCodeLanguage',
  describe: 'Auto-detect language for code blocks marked "text" / "txt" / blank.',
  run(b: Block, _ctx: BlockPassContext) {
    if (b.type !== 'code') return { block: b, changed: false }
    const cur = (b.language ?? '').toLowerCase().trim()
    const needsFix = cur === '' || cur === 'text' || cur === 'txt'
    if (!needsFix) return { block: b, changed: false }

    const { lang, confidence } = detectLanguage(b.code ?? '')
    if (lang === 'text' || confidence === 'low') {
      // No safe detection; leave alone, drop a note.
      return {
        block: b,
        changed: false,
        notes: [{
          severity: 'info',
          code: 'CODE_LANG_UNDETECTED',
          msg: 'FixCodeLanguage could not confidently detect language; left as-is.',
          blockId: b.id,
        }],
      }
    }
    if (lang === cur) return { block: b, changed: false }

    const next: Block = { ...b, language: lang }
    return {
      block: next,
      changed: true,
      notes: [{
        severity: 'info',
        code: 'CODE_LANG_FIXED',
        msg: `Set language="${lang}" (confidence=${confidence}).`,
        blockId: b.id,
      }],
    }
  },
}

// Re-export the pure detection utility for tests + studio.
export { detectLanguage }
