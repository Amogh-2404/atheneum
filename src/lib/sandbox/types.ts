// Worker ↔ main message protocol for the runnable code sandbox.
// Discriminated unions both ways so postMessage is never ambiguous.

export type SandboxLang = 'javascript' | 'typescript' | 'python'

/** main → worker */
export interface RunMsg {
  kind: 'run'
  id: number
  code: string
  stdin?: string
}

/** worker → main */
export type OutMsg =
  | { kind: 'ready' }                                                   // worker booted (py: Pyodide loaded)
  | { kind: 'progress'; text: string; pct?: number }                    // py cold-load progress
  | { kind: 'started'; id: number }                                     // user code is NOW executing — start the watchdog here, never during boot
  | { kind: 'out'; id: number; stream: 'stdout' | 'stderr'; chunk: string }
  | { kind: 'value'; id: number; repr: string }                         // a final expression value
  | { kind: 'done'; id: number }                                        // run finished cleanly
  | { kind: 'error'; id: number; message: string }                      // run threw

export type RunStatus = 'idle' | 'booting' | 'running' | 'done' | 'error' | 'timeout' | 'unavailable'

export interface ConsoleLine {
  stream: 'stdout' | 'stderr' | 'system'
  text: string
}
