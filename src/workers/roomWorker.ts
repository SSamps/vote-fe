import { io as socketIO } from 'socket.io-client'
import type {
  TabToWorkerMessage,
  WorkerToTabMessage,
  RoomStatePayload,
} from './roomWorkerTypes.js'

declare const self: { onconnect: ((event: MessageEvent) => void) | null }

interface RoomConnection {
  socket: ReturnType<typeof socketIO>
  ports: Set<MessagePort>
  lastState: RoomStatePayload | null
}

const rooms = new Map<string, RoomConnection>()

self.onconnect = (event: MessageEvent) => {
  const port = event.ports[0]
  let connectedRoomId: string | null = null

  port.onmessage = (e: MessageEvent<TabToWorkerMessage>) => {
    const msg = e.data

    if (msg.type === 'join') {
      const { backendUrl, roomId, role, token } = msg
      connectedRoomId = roomId

      const existing = rooms.get(roomId)

      if (existing) {
        existing.ports.add(port)
        if (existing.lastState) {
          const out: WorkerToTabMessage = { type: 'room:state', payload: existing.lastState }
          port.postMessage(out)
        }
        return
      }

      const socket = socketIO(backendUrl, {
        auth: { roomId, role, ...(token ? { token } : {}) },
        transports: ['websocket'],
      })

      const conn: RoomConnection = { socket, ports: new Set([port]), lastState: null }
      rooms.set(roomId, conn)

      const broadcast = (msg: WorkerToTabMessage) => {
        for (const p of conn.ports) p.postMessage(msg)
      }

      socket.on('room:state', (payload: RoomStatePayload) => {
        conn.lastState = payload
        broadcast({ type: 'room:state', payload })
      })

      socket.on('participant:joined', (payload: RoomStatePayload['participants'][number]) => {
        broadcast({ type: 'participant:joined', payload })
      })

      socket.on('participant:left', (payload: { name: string }) => {
        broadcast({ type: 'participant:left', payload })
      })

      socket.on('connect_error', (err: Error) => {
        broadcast({ type: 'connect_error', message: err.message })
      })

      socket.on('error', (payload: { message: string }) => {
        broadcast({ type: 'error', payload })
      })
    }

    if (msg.type === 'leave') {
      removePort(connectedRoomId, port)
      connectedRoomId = null
    }
  }
}

function removePort(roomId: string | null, port: MessagePort): void {
  if (!roomId) return
  const conn = rooms.get(roomId)
  if (!conn) return
  conn.ports.delete(port)
  if (conn.ports.size === 0) {
    conn.socket.disconnect()
    rooms.delete(roomId)
  }
}
