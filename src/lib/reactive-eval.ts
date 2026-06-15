/* ──────────────────────────────────────────────────────────────────────────
   Safe arithmetic evaluator for Reactive Math blocks.

   A reader can drag a slider and watch a formula recompute. The formula text
   ships inside content JSON, so it CANNOT go through eval()/new Function() — a
   malicious or malformed expression must never execute arbitrary code. This is a
   hand-written recursive-descent parser over a whitelisted grammar: numbers,
   named parameters, the operators + - * / % ^ (and unary ±), parentheses, and a
   fixed table of math functions. Anything else throws. No globals, no property
   access, no eval.
   ────────────────────────────────────────────────────────────────────────── */

/** Normal CDF via the Abramowitz & Stegun 7.1.26 erf approximation (pure JS). */
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x)
  return x >= 0 ? y : -y
}
function ncdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

/** The ONLY callable functions. No way to reach anything else. */
const FUNCS: Record<string, (...a: number[]) => number> = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log,
  log10: Math.log10,
  log2: Math.log2,
  abs: Math.abs,
  sign: Math.sign,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  hypot: Math.hypot,
  erf,
  ncdf,
  norm: ncdf,
}

const CONSTS: Record<string, number> = {
  pi: Math.PI,
  PI: Math.PI,
  e: Math.E,
  E: Math.E,
  tau: Math.PI * 2,
}

interface Tok {
  t: 'num' | 'id' | 'op' | 'lp' | 'rp' | 'comma'
  v: string
}

const TOKEN_RE =
  /\s*([0-9]*\.?[0-9]+(?:[eE][+\-]?[0-9]+)?|[A-Za-z_][A-Za-z0-9_]*|\*\*|[+\-*/%^(),])/g

function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let last = 0
  TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TOKEN_RE.exec(src))) {
    if (src.slice(last, m.index).trim() !== '') {
      throw new Error(`unexpected character near "${src.slice(last, m.index)}"`)
    }
    last = TOKEN_RE.lastIndex
    const v = m[1]
    if (/^[0-9.]/.test(v)) toks.push({ t: 'num', v })
    else if (/^[A-Za-z_]/.test(v)) toks.push({ t: 'id', v })
    else if (v === '(') toks.push({ t: 'lp', v })
    else if (v === ')') toks.push({ t: 'rp', v })
    else if (v === ',') toks.push({ t: 'comma', v })
    else toks.push({ t: 'op', v: v === '**' ? '^' : v })
  }
  if (src.slice(last).trim() !== '') {
    throw new Error(`unexpected trailing characters "${src.slice(last)}"`)
  }
  return toks
}

/**
 * Evaluate `expr` with the given numeric `scope`. Throws on any unknown name,
 * malformed syntax, or non-finite result. Pure — no side effects, no eval.
 */
export function evalExpr(expr: string, scope: Record<string, number>): number {
  const toks = tokenize(expr)
  let pos = 0
  const peek = (): Tok | undefined => toks[pos]
  const eat = (): Tok => toks[pos++]

  function parseExpr(): number {
    let v = parseTerm()
    let tk = peek()
    while (tk && tk.t === 'op' && (tk.v === '+' || tk.v === '-')) {
      eat()
      const r = parseTerm()
      v = tk.v === '+' ? v + r : v - r
      tk = peek()
    }
    return v
  }
  function parseTerm(): number {
    let v = parseUnary()
    let tk = peek()
    while (tk && tk.t === 'op' && (tk.v === '*' || tk.v === '/' || tk.v === '%')) {
      eat()
      const r = parseUnary()
      v = tk.v === '*' ? v * r : tk.v === '/' ? v / r : v % r
      tk = peek()
    }
    return v
  }
  function parseUnary(): number {
    const tk = peek()
    if (tk && tk.t === 'op' && (tk.v === '-' || tk.v === '+')) {
      eat()
      const v = parseUnary()
      return tk.v === '-' ? -v : v
    }
    return parsePow()
  }
  function parsePow(): number {
    const base = parseBase()
    const tk = peek()
    if (tk && tk.t === 'op' && tk.v === '^') {
      eat()
      // right-associative, and binds tighter than unary on the right (2^-1)
      const exp = parseUnary()
      return Math.pow(base, exp)
    }
    return base
  }
  function parseBase(): number {
    const tk = peek()
    if (!tk) throw new Error('unexpected end of expression')
    if (tk.t === 'num') {
      eat()
      return parseFloat(tk.v)
    }
    if (tk.t === 'lp') {
      eat()
      const v = parseExpr()
      if (peek()?.t !== 'rp') throw new Error('expected )')
      eat()
      return v
    }
    if (tk.t === 'id') {
      eat()
      if (peek()?.t === 'lp') {
        eat()
        const args: number[] = []
        if (peek()?.t !== 'rp') {
          args.push(parseExpr())
          while (peek()?.t === 'comma') {
            eat()
            args.push(parseExpr())
          }
        }
        if (peek()?.t !== 'rp') throw new Error('expected )')
        eat()
        const fn = FUNCS[tk.v]
        if (!fn) throw new Error(`unknown function "${tk.v}"`)
        return fn(...args)
      }
      if (Object.prototype.hasOwnProperty.call(scope, tk.v)) return scope[tk.v]
      if (Object.prototype.hasOwnProperty.call(CONSTS, tk.v)) return CONSTS[tk.v]
      throw new Error(`unknown name "${tk.v}"`)
    }
    throw new Error(`unexpected "${tk.v}"`)
  }

  const result = parseExpr()
  if (pos !== toks.length) throw new Error('unexpected trailing tokens')
  if (!Number.isFinite(result)) throw new Error('expression did not produce a finite number')
  return result
}

/** Format a number for display: fixed precision, trailing zeros trimmed. */
export function formatNumber(n: number, precision = 4): string {
  if (!Number.isFinite(n)) return '—'
  if (Number.isInteger(n)) return String(n)
  const fixed = n.toFixed(precision)
  return fixed.replace(/\.?0+$/, '')
}

/** A param's live value, resolved derived bindings, ready for template substitution. */
export interface ResolvedScope {
  scope: Record<string, number>
  error: string | null
}

/**
 * Build the full scope: start from param values, then evaluate each derived
 * binding in order (so a binding may reference earlier ones). Never throws —
 * returns the first error string instead, so the component can render gracefully.
 */
export function resolveScope(
  paramValues: Record<string, number>,
  derived: Array<{ name: string; expr: string }> = []
): ResolvedScope {
  const scope: Record<string, number> = { ...paramValues }
  for (const d of derived) {
    try {
      scope[d.name] = evalExpr(d.expr, scope)
    } catch (err) {
      return { scope, error: `${d.name}: ${(err as Error).message}` }
    }
  }
  return { scope, error: null }
}

/**
 * Substitute a LaTeX template's reactive placeholders:
 *   \val{name}   → the current numeric value of `name` (param or derived)
 *   \calc{expr}  → the evaluated result of an inline arithmetic expression
 * Both are non-KaTeX commands, so they only ever appear where the author put
 * them — no collision with real LaTeX braces. Returns the substituted LaTeX.
 */
export function substituteTemplate(
  template: string,
  scope: Record<string, number>,
  precision = 4
): string {
  let out = template.replace(/\\calc\{([^{}]*)\}/g, (_m, expr) => {
    try {
      return formatNumber(evalExpr(expr, scope), precision)
    } catch {
      return '\\,?\\,'
    }
  })
  out = out.replace(/\\val\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_m, name) => {
    const v = scope[name]
    return v === undefined ? '\\,?\\,' : formatNumber(v, precision)
  })
  return out
}
