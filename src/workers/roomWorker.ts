import { io as socketIO } from 'socket.io-client'
import type {
  TabToWorkerMessage,
  WorkerToTabMessage,
  RoomStatePayload,
  ResultsPayload,
  StageChangedPayload,
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

      socket.on('stage:changed', (payload: StageChangedPayload) => {
        if (conn.lastState) {
          let updated = { ...conn.lastState, stage: payload.stage }
          if (payload.stage === 'voting') {
            updated = {
              ...updated,
              questions: payload.questions ?? updated.questions,
              myVotes: (payload.questions ?? updated.questions).map(() => null),
              participants: updated.participants.map((p) => ({ ...p, voteCount: 0 })),
            }
          } else if (payload.stage === 'planning') {
            updated = {
              ...updated,
              questions: [],
              myVotes: [],
              results: null,
              participants: updated.participants.map((p) => ({ ...p, voteCount: 0 })),
            }
          }
          conn.lastState = updated
        }
        broadcast({ type: 'stage:changed', payload })
      })

      socket.on('participant:joined', (payload: RoomStatePayload['participants'][number]) => {
        broadcast({ type: 'participant:joined', payload })
      })

      socket.on('participant:left', (payload: { name: string }) => {
        broadcast({ type: 'participant:left', payload })
      })

      socket.on('participant:voted', (payload: { name: string; voteCount: number }) => {
        if (conn.lastState) {
          conn.lastState = {
            ...conn.lastState,
            participants: conn.lastState.participants.map((p) =>
              p.name === payload.name ? { ...p, voteCount: payload.voteCount } : p,
            ),
          }
        }
        broadcast({ type: 'participant:voted', payload })
      })

      socket.on('results', (payload: ResultsPayload) => {
        if (conn.lastState) conn.lastState = { ...conn.lastState, results: payload }
        broadcast({ type: 'results', payload })
      })

      socket.on('room:closed', () => {
        broadcast({ type: 'room:closed' })
        conn.socket.disconnect()
        rooms.delete(roomId)
      })

      socket.on('connect_error', (err: Error) => {
        broadcast({ type: 'connect_error', message: err.message })
      })

      socket.on('error', (payload: { message: string }) => {
        broadcast({ type: 'error', payload })
      })
    }

    if (msg.type === 'end-voting' || msg.type === 'revote' || msg.type === 'reset') {
      const conn = connectedRoomId ? rooms.get(connectedRoomId) : undefined
      if (conn) conn.socket.emit(msg.type, {})
    }

    if (msg.type === 'force-leave') {
      const conn = connectedRoomId ? rooms.get(connectedRoomId) : undefined
      if (conn) {
        for (const p of conn.ports) p.postMessage({ type: 'force-leave' } satisfies WorkerToTabMessage)
        conn.socket.emit('close-room', {})
        conn.socket.disconnect()
        rooms.delete(connectedRoomId!)
      }
    }

    if (msg.type === 'start-voting') {
      const conn = connectedRoomId ? rooms.get(connectedRoomId) : undefined
      if (conn) conn.socket.emit('start-voting', { questions: msg.questions })
    }

    if (msg.type === 'vote') {
      const conn = connectedRoomId ? rooms.get(connectedRoomId) : undefined
      if (conn) conn.socket.emit('vote', { questionIndex: msg.questionIndex, value: msg.value })
    }

    if (msg.type === 'unvote') {
      const conn = connectedRoomId ? rooms.get(connectedRoomId) : undefined
      if (conn) conn.socket.emit('unvote', { questionIndex: msg.questionIndex })
    }

    if (msg.type === 'sync') {
      const conn = connectedRoomId ? rooms.get(connectedRoomId) : undefined
      if (conn?.lastState) {
        const out: WorkerToTabMessage = { type: 'room:state', payload: conn.lastState }
        port.postMessage(out)
      }
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
