const API_BASE = '/api'

export async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

/** Absolute API URL — for <img src>/<a href> to streamed resources (attachments). */
export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

/**
 * POST a FormData (multipart) with upload-progress reporting. Uses XMLHttpRequest
 * because fetch() cannot report upload progress — which matters over a slow Tailscale
 * link from a phone. Never sets Content-Type (the browser adds the multipart boundary).
 */
export function postForm<T>(
  path: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}${path}`)
    xhr.timeout = 120_000
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      let parsed: unknown = null
      try { parsed = JSON.parse(xhr.responseText) } catch { /* non-JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(parsed as T)
      else reject(Object.assign(new Error(`API error: ${xhr.status}`), { status: xhr.status, body: parsed }))
    }
    xhr.onerror = () => reject(new Error('network error'))
    xhr.ontimeout = () => reject(new Error('upload timed out'))
    xhr.send(form)
  })
}
