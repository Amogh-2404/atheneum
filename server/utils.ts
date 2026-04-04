import path from 'path'

/**
 * Sanitize a route parameter (bookId, chapterId) to prevent path traversal.
 * Only allows alphanumeric characters, hyphens, and underscores.
 * Returns null if the ID is invalid.
 */
export function sanitizeId(id: string): string | null {
  if (!id || typeof id !== 'string') return null
  // Strip anything that isn't alphanumeric, hyphen, or underscore
  const clean = id.replace(/[^a-zA-Z0-9\-_]/g, '')
  // Must not be empty after cleaning, and must match original (no sneaky chars)
  if (!clean || clean !== id) return null
  return clean
}

/**
 * Resolve a path within a base directory, ensuring it doesn't escape.
 * Returns null if the resolved path is outside basedir.
 */
export function safePath(baseDir: string, ...segments: string[]): string | null {
  const resolved = path.resolve(baseDir, ...segments)
  const normalizedBase = path.resolve(baseDir)
  if (!resolved.startsWith(normalizedBase + path.sep) && resolved !== normalizedBase) {
    return null
  }
  return resolved
}
