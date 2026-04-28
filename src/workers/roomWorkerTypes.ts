export interface ParticipantView {
  name: string
  role: 'facilitator' | 'participant'
  hasVoted: boolean
}

export interface RoomStatePayload {
  roomId: string
  stage: string
  myName: string
  myRole: string
  participants: ParticipantView[]
}

export type TabToWorkerMessage =
  | { type: 'join'; backendUrl: string; roomId: string; role: string; token?: string }
  | { type: 'leave' }

export type WorkerToTabMessage =
  | { type: 'room:state'; payload: RoomStatePayload }
  | { type: 'participant:joined'; payload: ParticipantView }
  | { type: 'participant:left'; payload: { name: string } }
  | { type: 'connect_error'; message: string }
  | { type: 'error'; payload: { message: string } }
