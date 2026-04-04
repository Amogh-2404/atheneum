import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'

interface Client {
  id: string
  ws: WebSocket
  subscriptions: Set<string>  // bookId or bookId/chapterId
  lastPong: number
}

export class ConnectionManager {
  private wss: WebSocketServer
  private clients: Map<string, Client> = new Map()
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null

  constructor(server: any) {
    // Attach to existing HTTP server, only accept /ws path
    this.wss = new WebSocketServer({ server, path: '/ws' })
    this.wss.on('connection', this.handleConnection.bind(this))
    this.startHeartbeat()
    console.log('[ws] WebSocket server attached at /ws')
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage) {
    console.log(`[ws] Client connected from ${req.headers.origin || 'unknown'}`)
    const clientId = crypto.randomUUID()
    const client: Client = { id: clientId, ws, subscriptions: new Set(), lastPong: Date.now() }
    this.clients.set(clientId, client)

    ws.send(JSON.stringify({ type: 'connected', clientId }))

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString())
        if (msg.type === 'subscribe') {
          const key = msg.chapterId ? `${msg.bookId}/${msg.chapterId}` : msg.bookId
          client.subscriptions.add(msg.bookId) // always subscribe to book level
          if (msg.chapterId) client.subscriptions.add(key)
        } else if (msg.type === 'unsubscribe') {
          // Remove all subscriptions for this book
          for (const sub of client.subscriptions) {
            if (sub === msg.bookId || sub.startsWith(`${msg.bookId}/`)) {
              client.subscriptions.delete(sub)
            }
          }
        } else if (msg.type === 'pong') {
          client.lastPong = Date.now()
        }
      } catch {
        // Ignore malformed messages
      }
    })

    ws.on('pong', () => { client.lastPong = Date.now() })
    ws.on('close', () => { this.clients.delete(clientId) })
    ws.on('error', () => { this.clients.delete(clientId) })
  }

  broadcast(bookId: string, chapterId: string | null, message: object) {
    const json = JSON.stringify(message)
    for (const client of this.clients.values()) {
      if (client.ws.readyState !== WebSocket.OPEN) continue
      const matchBook = client.subscriptions.has(bookId)
      const matchChapter = chapterId && client.subscriptions.has(`${bookId}/${chapterId}`)
      if (matchBook || matchChapter) {
        client.ws.send(json)
      }
    }
  }

  broadcastAll(message: object) {
    const json = JSON.stringify(message)
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(json)
      }
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now()
      for (const [id, client] of this.clients) {
        // Terminate clients that haven't responded in 60s
        if (now - client.lastPong > 60000) {
          client.ws.terminate()
          this.clients.delete(id)
          continue
        }
        // Send WebSocket-level ping + application-level heartbeat
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping()
        }
      }
      this.broadcastAll({ type: 'heartbeat' })
    }, 30000)
  }

  get clientCount() { return this.clients.size }

  shutdown() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
    this.wss.close()
  }
}
