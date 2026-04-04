import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { WSClient, type WSStatus } from '@/lib/ws-client'

interface WSContextValue {
  client: WSClient | null
  connected: boolean
  status: WSStatus
}

const WSContext = createContext<WSContextValue>({ client: null, connected: false, status: 'disconnected' })

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const clientRef = useRef<WSClient | null>(null)
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState<WSStatus>('connecting')

  useEffect(() => {
    // In dev, connect directly to the API server port for WebSocket
    // In production, both are served from the same port
    const isDev = window.location.port === '5200'
    const wsHost = isDev ? `${window.location.hostname}:3100` : window.location.host
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${wsHost}/ws`
    const client = new WSClient(wsUrl)
    clientRef.current = client

    const offConnected = client.on('_connected', () => setConnected(true))
    const offStatus = client.on('_status', (msg) => {
      setStatus(msg.status)
      setConnected(msg.status === 'connected')
    })
    // Respond to heartbeats to keep the connection alive
    const offHeartbeat = client.on('heartbeat', () => {
      client.send({ type: 'pong' })
    })

    return () => {
      offConnected()
      offStatus()
      offHeartbeat()
      client.close()
    }
  }, [])

  return (
    <WSContext.Provider value={{ client: clientRef.current, connected, status }}>
      {children}
    </WSContext.Provider>
  )
}

export function useWS() { return useContext(WSContext) }
export function useWSStatus(): WSStatus { return useContext(WSContext).status }
