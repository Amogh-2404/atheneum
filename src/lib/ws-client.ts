type MessageHandler = (message: any) => void

export class WSClient {
  private ws: WebSocket | null = null
  private url: string
  private handlers: Map<string, Set<MessageHandler>> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectTimer: number | null = null
  private closed = false

  constructor(url: string) {
    this.url = url
    this.connect()
  }

  private connect() {
    if (this.closed) return
    try {
      this.ws = new WebSocket(this.url)
      this.ws.onopen = () => {
        this.reconnectAttempts = 0
        this.emit('_connected', {})
      }
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          this.emit(msg.type, msg)
        } catch {}
      }
      this.ws.onclose = () => { this.scheduleReconnect() }
      this.ws.onerror = () => { /* onclose will fire */ }
    } catch {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    if (this.closed || this.reconnectAttempts >= this.maxReconnectAttempts) return
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000)
    this.reconnectAttempts++
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay)
  }

  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler)
    return () => { this.handlers.get(type)?.delete(handler) }
  }

  private emit(type: string, message: any) {
    this.handlers.get(type)?.forEach(h => h(message))
  }

  send(message: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  subscribe(bookId: string, chapterId?: string) {
    this.send({ type: 'subscribe', bookId, chapterId })
  }

  unsubscribe(bookId: string) {
    this.send({ type: 'unsubscribe', bookId })
  }

  get connected() { return this.ws?.readyState === WebSocket.OPEN }

  close() {
    this.closed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.close()
  }
}
