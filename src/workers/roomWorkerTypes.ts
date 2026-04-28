export interface ParticipantView {
  name: string
  role: 'facilitator' | 'participant'
  hasVoted: boolean
}

export type Stage = 'planning' | 'voting' | 'review'

export interface RoomStatePayload {
  roomId: string
  stage: Stage
  myName: string
  myRole: string
  participants: ParticipantView[]
  expiresAt: number
}

export type TabToWorkerMessage =
  | { type: 'join'; backendUrl: string; roomId: string; role: string; token?: string }
  | { type: 'leave' }
  | { type: 'start-voting' }
  | { type: 'end-voting' }
  | { type: 'reset' }

export type WorkerToTabMessage =
  | { type: 'room:state'; payload: RoomStatePayload }
  | { type: 'stage:changed'; payload: { stage: Stage } }
  | { type: 'participant:joined'; payload: ParticipantView }
  | { type: 'participant:left'; payload: { name: string } }
  | { type: 'room:closed' }
  | { type: 'connect_error'; message: string }
  | { type: 'error'; payload: { message: string } }
