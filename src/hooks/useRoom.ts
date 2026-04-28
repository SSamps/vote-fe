import { useState, useEffect, useRef, useCallback } from 'react'
import type {
  TabToWorkerMessage,
  WorkerToTabMessage,
  ResultsPayload,
  Stage,
  ParticipantView,
} from '../workers/roomWorkerTypes.js'

const BACKEND_URL =
  window.env?.VITE_BACKEND_URL ?? import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000'

export interface UseRoomResult {
  stage: Stage
  questions: Array<{ prompt: string; options: number[] }>
  myVotes: (number | null)[]
  results: ResultsPayload | null
  participants: ParticipantView[]
  myName: string | null
  expiresAt: number | null
  roomClosed: boolean
  forcedOut: boolean
  error: string | null
  clearError: () => void
  startVoting: (questions: Array<{ prompt: string; options: number[] }>) => void
  vote: (questionIndex: number, value: number) => void
  unvote: (questionIndex: number) => void
  endVoting: () => void
  revote: () => void
  reset: () => void
  forceLeave: () => void
}

export function useRoom(
  roomId: string | undefined,
  role: 'facilitator' | 'participant',
  token: string | null,
): UseRoomResult {
  const [stage, setStage] = useState<Stage>('planning')
  const [questions, setQuestions] = useState<Array<{ prompt: string; options: number[] }>>([])
  const [myVotes, setMyVotes] = useState<(number | null)[]>([])
  const [results, setResults] = useState<ResultsPayload | null>(null)
  const [participants, setParticipants] = useState<ParticipantView[]>([])
  const [myName, setMyName] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [roomClosed, setRoomClosed] = useState(false)
  const [forcedOut, setForcedOut] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const portRef = useRef<MessagePort | null>(null)

  const send = useCallback((msg: TabToWorkerMessage) => {
    portRef.current?.postMessage(msg)
  }, [])

  useEffect(() => {
    if (!roomId) return

    const worker = new SharedWorker(
      new URL('../workers/roomWorker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.port.start()
    portRef.current = worker.port

    worker.port.postMessage({
      type: 'join',
      backendUrl: BACKEND_URL,
      roomId,
      role,
      ...(token ? { token } : {}),
    } satisfies TabToWorkerMessage)

    worker.port.onmessage = (e: MessageEvent<WorkerToTabMessage>) => {
      const msg = e.data
      if (msg.type === 'room:state') {
        setStage(msg.payload.stage)
        setQuestions(msg.payload.questions)
        setMyVotes(msg.payload.myVotes)
        setResults(msg.payload.results)
        setMyName(msg.payload.myName)
        setParticipants(msg.payload.participants)
        setExpiresAt(msg.payload.expiresAt)
      } else if (msg.type === 'stage:changed') {
        setStage(msg.payload.stage)
        if (msg.payload.stage === 'voting') {
          const qs = msg.payload.questions ?? []
          setQuestions(qs)
          setMyVotes(qs.map(() => null))
          setParticipants((prev) => prev.map((p) => ({ ...p, voteCount: 0 })))
        } else if (msg.payload.stage === 'planning') {
          setMyVotes([])
          setResults(null)
          setParticipants((prev) => prev.map((p) => ({ ...p, voteCount: 0 })))
        }
      } else if (msg.type === 'participant:joined') {
        setParticipants((prev) => [...prev, msg.payload])
      } else if (msg.type === 'participant:left') {
        setParticipants((prev) => prev.filter((p) => p.name !== msg.payload.name))
      } else if (msg.type === 'participant:voted') {
        setParticipants((prev) =>
          prev.map((p) => p.name === msg.payload.name ? { ...p, voteCount: msg.payload.voteCount } : p),
        )
      } else if (msg.type === 'results') {
        setResults(msg.payload)
      } else if (msg.type === 'force-leave') {
        setForcedOut(true)
      } else if (msg.type === 'room:closed') {
        setRoomClosed(true)
      } else if (msg.type === 'connect_error') {
        setError(msg.message)
      } else if (msg.type === 'error') {
        setError(msg.payload.message)
        portRef.current?.postMessage({ type: 'sync' } satisfies TabToWorkerMessage)
      }
    }

    return () => {
      portRef.current = null
      worker.port.postMessage({ type: 'leave' } satisfies TabToWorkerMessage)
      worker.port.close()
    }
  }, [roomId, role, token])

  const startVoting = useCallback(
    (qs: Array<{ prompt: string; options: number[] }>) =>
      send({ type: 'start-voting', questions: qs }),
    [send],
  )

  const vote = useCallback((questionIndex: number, value: number) => {
    setMyVotes((prev) => { const next = [...prev]; next[questionIndex] = value; return next })
    send({ type: 'vote', questionIndex, value })
  }, [send])

  const unvote = useCallback((questionIndex: number) => {
    setMyVotes((prev) => { const next = [...prev]; next[questionIndex] = null; return next })
    send({ type: 'unvote', questionIndex })
  }, [send])

  const endVoting = useCallback(() => send({ type: 'end-voting' }), [send])
  const revote = useCallback(() => send({ type: 'revote' }), [send])
  const reset = useCallback(() => send({ type: 'reset' }), [send])
  const forceLeave = useCallback(() => send({ type: 'force-leave' }), [send])
  const clearError = useCallback(() => setError(null), [])

  return {
    stage, questions, myVotes, results, participants, myName,
    expiresAt, roomClosed, forcedOut, error, clearError,
    startVoting, vote, unvote, endVoting, revote, reset, forceLeave,
  }
}
