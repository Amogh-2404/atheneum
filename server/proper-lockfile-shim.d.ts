// Ambient fallback for `proper-lockfile`. The real @types/proper-lockfile is
// installed under mcp/node_modules and resolves for files inside mcp/, but
// server/ sits outside that node_modules tree (the worktree's root
// node_modules is a read-only symlink to the live install, which lacks the
// @types). This minimal declaration covers the lock/unlock/check surface the
// server uses so the tree type-checks. Pulled into the program via a
// triple-slash reference from git.ts. Runtime is unaffected.
declare module 'proper-lockfile' {
  interface LockOptions {
    stale?: number
    retries?: number | { retries: number; factor?: number; minTimeout?: number; maxTimeout?: number }
    realpath?: boolean
    update?: number
    lockfilePath?: string
  }
  export function lock(file: string, options?: LockOptions): Promise<() => Promise<void>>
  export function unlock(file: string, options?: { realpath?: boolean }): Promise<void>
  export function check(file: string, options?: { stale?: number; realpath?: boolean }): Promise<boolean>
}
