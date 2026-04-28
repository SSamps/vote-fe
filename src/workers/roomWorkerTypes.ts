export interface ParticipantView {
  name: string
  role: 'facilitator' | 'participant'
  voteCount: number
}

export type Stage = 'planning' | 'voting' | 'review'

export interface QuestionResult {
  prompt: string
  count: number
  average: number | null
  median: number | null
  mode: number[] | null
  breakdown: Array<{ value: number; votes: number }>
}

export interface ResultsPayload {
  questions: QuestionResult[]
}

export interface StageChangedPayload {
  stage: Stage
  questions?: Array<{ prompt: string; options: number[] }>
}

export interface RoomStatePayload {
  roomId: string
  stage: Stage
  questions: Array<{ prompt: string; options: number[] }>
  myVotes: (number | null)[]
  results: ResultsPayload | null
  myName: string
  myRole: string
  participants: ParticipantView[]
  expiresAt: number
}

export type TabToWorkerMessage =
  | { type: 'join'; backendUrl: string; roomId: string; role: string; token?: string }
  | { type: 'leave' }
  | { type: 'start-voting'; questions: Array<{ prompt: string; options: number[] }> }
  | { type: 'end-voting' }
  | { type: 'revote' }
  | { type: 'reset' }
  | { type: 'force-leave' }
  | { type: 'vote'; questionIndex: number; value: number }
  | { type: 'unvote'; questionIndex: number }

export type WorkerToTabMessage =
  | { type: 'room:state'; payload: RoomStatePayload }
  | { type: 'stage:changed'; payload: StageChangedPayload }
  | { type: 'participant:joined'; payload: ParticipantView }
  | { type: 'participant:left'; payload: { name: string } }
  | { type: 'participant:voted'; payload: { name: string; voteCount: number } }
  | { type: 'results'; payload: ResultsPayload }
  | { type: 'force-leave' }
  | { type: 'room:closed' }
  | { type: 'connect_error'; message: string }
  | { type: 'error'; payload: { message: string } }
