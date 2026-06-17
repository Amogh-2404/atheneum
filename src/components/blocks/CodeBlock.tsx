import { useMemo, useState, useEffect, useCallback } from 'react'
import { Check, Copy, ArrowRight } from 'lucide-react'
import type { CodeBlock as CodeBlockType } from '@/types'
import { useToast } from '@/hooks/useToast'
import { useLearningProgress } from '@/hooks/useLearningProgress'

type CodeBlockProps = CodeBlockType & { bookId?: string; chapterId?: string }

// ─── Shiki Highlighter Singleton ─────────────────────────────────────

let highlighterPromise: Promise<any> | null = null

const PRELOADED_LANGS = [
  'python',
  'typescript',
  'javascript',
  'json',
  'bash',
  'html',
  'css',
  'tsx',
  'jsx',
  'go',
  'rust',
  'java',
  'c',
  'cpp',
  'sql',
  'yaml',
  'markdown',
  'shell',
  'llvm',
  'asm',
  'diff',
]

// Dual theme: light/sepia surfaces render the light palette, dark renders the
// dark one. Shiki emits both in a single pass (inline color + --shiki-dark var),
// so a [data-theme] change flips colors via CSS with no re-highlight.
const LIGHT_THEME = 'github-light'
const DARK_THEME = 'github-dark'

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki')
      .then(async (shiki) => {
        return shiki.createHighlighter({
          themes: [LIGHT_THEME, DARK_THEME],
          langs: PRELOADED_LANGS,
        })
      })
      .catch((err) => {
        console.warn('[CodeBlock] Failed to load Shiki highlighter:', err)
        highlighterPromise = null
        return null
      })
  }
  return highlighterPromise
}

// Eagerly start loading the highlighter on module init
getHighlighter()

/**
 * Highlight code with Shiki (dual-theme) and return per-line token spans.
 * Each token carries an inline light color plus a --shiki-dark var so the
 * surface re-themes via CSS on [data-theme] change with no re-highlight.
 * Falls back to null if Shiki is unavailable or the language is unsupported.
 */
async function highlightCode(
  code: string,
  language: string
): Promise<string[] | null> {
  try {
    const highlighter = await getHighlighter()
    if (!highlighter) return null

    // Normalize language aliases
    const langMap: Record<string, string> = {
      sh: 'bash',
      zsh: 'bash',
      ts: 'typescript',
      js: 'javascript',
      py: 'python',
      yml: 'yaml',
      md: 'markdown',
      'c++': 'cpp',
      // Compiler / LLVM dialects — fall back to closest grammar
      mir: 'llvm',
      mlir: 'llvm',
      hexagon: 'asm',
      tablegen: 'text',
      td: 'text',
      ldscript: 'text',
      idl: 'text',
    }
    const lang = langMap[language.toLowerCase()] ?? language.toLowerCase()

    // Check if the language is loaded; if not, try to load it dynamically
    const loadedLangs = highlighter.getLoadedLanguages()
    if (!loadedLangs.includes(lang)) {
      try {
        await highlighter.loadLanguage(lang as any)
      } catch {
        // Language not available — fall back to plain text
        return null
      }
    }

    // Use codeToHtml with dual themes and extract the inner content. Each token
    // carries an inline `color` (light) plus a `--shiki-dark` custom property
    // (dark); terminal.css selects per [data-theme].
    const html = highlighter.codeToHtml(code, {
      lang,
      themes: { light: LIGHT_THEME, dark: DARK_THEME },
      defaultColor: 'light',
    })

    // Shiki output: <pre ...><code ...>LINE_CONTENT</code></pre>
    // Extract inner content of <code>...</code>
    const codeMatch = html.match(/<code[^>]*>([\s\S]*)<\/code>/)
    if (!codeMatch) return null

    const innerHtml = codeMatch[1]

    // Split by Shiki's line markers.
    // Shiki wraps each line in <span class="line">...</span>.
    // We split on the opening tag and strip the trailing </span> from each chunk.
    const parts = innerHtml.split('<span class="line">')
    const lines: string[] = []

    for (const part of parts) {
      if (!part.trim()) continue
      // Remove the LAST </span> which closes the line wrapper
      // (inner token spans also have </span> so we must only strip the outermost)
      const lastClose = part.lastIndexOf('</span>')
      if (lastClose !== -1) {
        lines.push(part.slice(0, lastClose))
      } else {
        lines.push(part)
      }
    }

    // Fallback: if splitting didn't work, try newline split
    if (lines.length === 0) {
      return innerHtml.split('\n')
    }

    return lines
  } catch (err) {
    console.warn('[CodeBlock] Shiki highlighting failed:', err)
    return null
  }
}

// ─── CodeBlock Component ─────────────────────────────────────────────

/**
 * Code block — a flat editorial card. Uses CSS classes from terminal.css.
 * Syntax highlighting is theme-aware (Shiki dual-theme) and loads async.
 */
export default function CodeBlock({
  id: blockId,
  code,
  language,
  filename,
  highlightLines,
  annotations,
  showLineNumbers = true,
  // tiltSeed retained for prop/type compatibility; no longer used (skeuomorphism removed).
  tiltSeed: _tiltSeed,
  predict,
  expectedOutput,
  bookId,
  chapterId,
}: CodeBlockProps) {
  const rawLines = (code ?? '').split('\n')
  const [highlightedLines, setHighlightedLines] = useState<string[] | null>(null)
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()
  const { recordQuizAnswer } = useLearningProgress(bookId)

  // ── Predict-the-output mode ──────────────────────────────────────────
  // A code block becomes a retrieval event: hide the output, make the reader
  // commit a guess, then reveal truth beside the guess. The friction IS the
  // feature (generation effect). Attempt logged through the same quiz path the
  // StudyDashboard reads; a whitespace-only mismatch is overridable, never wrong.
  const isPredict = !!predict && typeof expectedOutput === 'string'
  const [guess, setGuess] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [overridden, setOverridden] = useState(false)
  const normalize = (s: string) => s.trim().replace(/\s+/g, ' ')
  const hasGuess = guess.trim().length > 0
  const matched =
    revealed && hasGuess && normalize(guess) === normalize(expectedOutput ?? '')
  const handleReveal = useCallback(() => {
    if (revealed) return
    setRevealed(true)
    const ok = guess.trim().length > 0 && normalize(guess) === normalize(expectedOutput ?? '')
    if (bookId && chapterId && blockId) {
      recordQuizAnswer(blockId, chapterId, `${blockId}_predict`, 0, ok)
    }
  }, [revealed, guess, expectedOutput, bookId, chapterId, blockId, recordQuizAnswer])
  const handleOverride = useCallback(() => {
    if (overridden) return
    setOverridden(true)
    if (bookId && chapterId && blockId) {
      recordQuizAnswer(blockId, chapterId, `${blockId}_predict`, 0, true)
    }
  }, [overridden, bookId, chapterId, blockId, recordQuizAnswer])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code ?? '')
      setCopied(true)
      toast('Copied to clipboard', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast('Failed to copy', 'error')
    }
  }, [code, toast])

  const highlightSet = useMemo(
    () => new Set(highlightLines ?? []),
    [highlightLines]
  )

  // Async Shiki highlighting
  useEffect(() => {
    if (!language || !code) return

    let cancelled = false

    highlightCode(code, language).then((lines) => {
      if (!cancelled && lines) {
        setHighlightedLines(lines)
      }
    })

    return () => {
      cancelled = true
    }
  }, [code, language])

  return (
    <div className="terminal-window">
      {/* Header: dots \u00b7 filename \u00b7 lang \u00b7 copy */}
      <div className="terminal-titlebar">
        <div className="terminal-dots" aria-hidden="true">
          <span className="terminal-dot" />
          <span className="terminal-dot" />
          <span className="terminal-dot" />
        </div>
        {filename && <span className="terminal-filename">{filename}</span>}
        {language && (
          <span
            className="terminal-lang"
            style={{ marginLeft: filename ? undefined : 'auto' }}
          >
            {language}
          </span>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className={copied ? 'code-copy-btn is-copied' : 'code-copy-btn'}
          aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
        >
          {copied ? (
            <Check size={13} aria-hidden="true" />
          ) : (
            <Copy size={13} aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Code body */}
      <div className="terminal-body">
        <pre className="shiki">
          <code>
            {rawLines.map((line, i) => {
              const lineNum = i + 1
              const isHighlighted = highlightSet.has(lineNum)
              const annotation = annotations?.[lineNum]
              const shikiHtml = highlightedLines?.[i] ?? null

              return (
                <div
                  key={i}
                  className={
                    isHighlighted
                      ? 'terminal-line terminal-line-highlighted'
                      : 'terminal-line'
                  }
                >
                  {showLineNumbers && (
                    <span className="terminal-line-number">{lineNum}</span>
                  )}
                  {shikiHtml ? (
                    <span
                      className="terminal-line-code"
                      dangerouslySetInnerHTML={{ __html: shikiHtml || '&nbsp;' }}
                    />
                  ) : (
                    <span className="terminal-line-code">
                      {line || '\u00a0'}
                    </span>
                  )}
                  {annotation && (
                    <span className="terminal-annotation">
                      {'// '}
                      {annotation}
                    </span>
                  )}
                </div>
              )
            })}
          </code>
        </pre>
      </div>

      {/* ── Predict-the-output footer ── */}
      {isPredict && (
        <div className="terminal-predict">
          {!revealed ? (
            <>
              <div className="terminal-predict-label">
                Predict the output before you reveal it
              </div>
              <textarea
                className="terminal-predict-input"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="What does this print?"
                spellCheck={false}
                rows={2}
                aria-label="Predict the output"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleReveal()
                }}
              />
              <button
                type="button"
                className="terminal-predict-reveal"
                onClick={handleReveal}
              >
                Reveal output
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {hasGuess && (
                <div>
                  <div className="terminal-predict-caption">Your prediction</div>
                  <pre className="terminal-predict-block is-guess">{guess}</pre>
                </div>
              )}
              <div>
                <div className="terminal-predict-caption">Actual output</div>
                <pre
                  className={
                    matched || overridden
                      ? 'terminal-predict-block is-match'
                      : 'terminal-predict-block'
                  }
                >
                  {expectedOutput}
                </pre>
              </div>
              {hasGuess && (
                <div
                  className={
                    matched || overridden
                      ? 'terminal-predict-verdict is-match'
                      : 'terminal-predict-verdict is-differ'
                  }
                >
                  {matched || overridden ? (
                    <>
                      <Check size={14} aria-hidden="true" />
                      Matched
                    </>
                  ) : (
                    <>
                      <span>Differs from the actual output</span>
                      <button
                        type="button"
                        className="terminal-predict-override"
                        onClick={handleOverride}
                      >
                        I was right{' '}
                        <ArrowRight size={13} aria-hidden="true" style={{ verticalAlign: 'text-bottom' }} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
