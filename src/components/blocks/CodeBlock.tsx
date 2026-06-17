import { useMemo, useState, useEffect, useCallback } from 'react'
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

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki')
      .then(async (shiki) => {
        return shiki.createHighlighter({
          themes: ['github-dark'],
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
 * Highlight code with Shiki and return per-line token spans.
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

    // Use codeToHtml and extract the inner content
    const html = highlighter.codeToHtml(code, {
      lang,
      theme: 'github-dark',
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
 * Terminal code block — macOS window chrome "taped to the notebook page".
 * Uses CSS classes from terminal.css.
 * Shiki syntax highlighting loads asynchronously.
 */
export default function CodeBlock({
  id: blockId,
  code,
  language,
  filename,
  highlightLines,
  annotations,
  showLineNumbers = true,
  tiltSeed,
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

  // Deterministic tilt from seed, range [-1.2, 1.2] degrees
  const tilt = useMemo(() => {
    if (tiltSeed == null) return -0.5
    const hash = ((tiltSeed * 2654435761) >>> 0) / 4294967296
    return (hash - 0.5) * 2.4
  }, [tiltSeed])

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
    <div
      className="terminal-window"
      style={{ '--tilt': `${tilt}deg` } as React.CSSProperties}
    >
      {/* macOS title bar */}
      <div className="terminal-titlebar">
        <div style={{ display: 'flex', gap: '6px' }}>
          <span className="terminal-dot terminal-dot-close" />
          <span className="terminal-dot terminal-dot-minimize" />
          <span className="terminal-dot terminal-dot-maximize" />
        </div>
        {filename && <span className="terminal-filename">{filename}</span>}
        {language && (
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.6875rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#888',
              marginLeft: filename ? '0' : 'auto',
            }}
          >
            {language}
          </span>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="code-copy-btn"
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: copied ? '#16a34a' : 'rgba(255,255,255,0.4)',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            padding: '2px 6px',
            borderRadius: 4,
            transition: 'color 200ms, background 150ms',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
          onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
        >
          {copied ? '\u2713 Copied' : 'Copy'}
        </button>
      </div>

      {/* Code body */}
      <div className="terminal-body">
        <pre style={{ margin: 0 }}>
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
                    isHighlighted ? 'terminal-line-highlighted' : undefined
                  }
                  style={{
                    display: 'flex',
                    padding: '0 1.5rem',
                    minHeight: '1.7em',
                  }}
                >
                  {showLineNumbers && (
                    <span className="terminal-line-number">{lineNum}</span>
                  )}
                  {shikiHtml ? (
                    <span
                      style={{ flex: 1, whiteSpace: 'pre' }}
                      dangerouslySetInnerHTML={{ __html: shikiHtml || '&nbsp;' }}
                    />
                  ) : (
                    <span style={{ flex: 1, color: '#d4d4d4', whiteSpace: 'pre' }}>
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
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(0,0,0,0.18)',
            padding: '0.85rem 1.5rem 1.05rem',
          }}
        >
          {!revealed ? (
            <>
              <div
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.66rem',
                  letterSpacing: '0.09em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: 8,
                }}
              >
                Predict the output before you reveal it
              </div>
              <textarea
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="What does this print?"
                spellCheck={false}
                rows={2}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleReveal()
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'var(--font-code)',
                  fontSize: '0.85rem',
                  lineHeight: 1.5,
                  color: '#d4d4d4',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 5,
                  padding: '0.5rem 0.6rem',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleReveal}
                style={{
                  marginTop: 8,
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  color: '#0a0e17',
                  background: 'var(--chrome-accent, var(--chrome-accent))',
                  border: 'none',
                  borderRadius: 5,
                  padding: '0.45rem 0.95rem',
                  cursor: 'pointer',
                }}
              >
                Reveal output
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {hasGuess && (
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: '0.6rem',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.4)',
                      marginBottom: 4,
                    }}
                  >
                    Your prediction
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-code)',
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: 'rgba(212,212,212,0.65)',
                      background: 'rgba(0,0,0,0.28)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 5,
                      padding: '0.5rem 0.6rem',
                    }}
                  >
                    {guess}
                  </pre>
                </div>
              )}
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.6rem',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.4)',
                    marginBottom: 4,
                  }}
                >
                  Actual output
                </div>
                <pre
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-code)',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: '#d4d4d4',
                    background: 'rgba(0,0,0,0.32)',
                    border: `1px solid ${matched || overridden ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 5,
                    padding: '0.5rem 0.6rem',
                  }}
                >
                  {expectedOutput}
                </pre>
              </div>
              {hasGuess && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.74rem',
                  }}
                >
                  {matched || overridden ? (
                    <span style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Matched
                    </span>
                  ) : (
                    <>
                      <span style={{ color: '#f59e0b' }}>Differs from the actual output</span>
                      <button
                        type="button"
                        onClick={handleOverride}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: 'var(--chrome-accent, var(--chrome-accent))',
                          fontFamily: 'var(--font-ui)',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                        }}
                      >
                        I was right &rarr;
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
