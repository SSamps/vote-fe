import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

import type { ParticipantView, WorkerToTabMessage, Stage } from '../workers/roomWorkerTypes.js'
import PlanningForm from '../components/PlanningForm/PlanningForm.js'
import styles from './RoomPage.module.css'

const BACKEND_URL =
  window.env?.VITE_BACKEND_URL ?? import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000'

type Status = 'loading' | 'found' | 'not-found' | 'error'

function formatTimeLeft(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const token = roomId ? localStorage.getItem(`facilitator-token-${roomId}`) : null
  const role = token ? 'facilitator' : 'participant'
  const [status, setStatus] = useState<Status>('loading')
  const [stage, setStage] = useState<Stage>('planning')
  const [participants, setParticipants] = useState<ParticipantView[]>([])
  const [myName, setMyName] = useState<string | null>(null)
  const workerPortRef = useRef<MessagePort | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [roomClosed, setRoomClosed] = useState(false)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (!roomId) {
      setStatus('not-found')
      return
    }
    let cancelled = false
    fetch(`${BACKEND_URL}/rooms/${roomId}`)
      .then((res) => {
        if (cancelled) return
        setStatus(res.status === 404 ? 'not-found' : res.ok ? 'found' : 'error')
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [roomId])

  useEffect(() => {
    if (status !== 'found' || !roomId) return

    const worker = new SharedWorker(
      new URL('../workers/roomWorker.ts', import.meta.url),
      { type: 'module' },
    )

    worker.port.start()
    workerPortRef.current = worker.port
    worker.port.postMessage({ type: 'join', backendUrl: BACKEND_URL, roomId, role, token })

    worker.port.onmessage = (e: MessageEvent<WorkerToTabMessage>) => {
      const msg = e.data
      if (msg.type === 'room:state') {
        setStage(msg.payload.stage)
        setMyName(msg.payload.myName)
        setParticipants(msg.payload.participants)
        setExpiresAt(msg.payload.expiresAt)
      } else if (msg.type === 'stage:changed') {
        setStage(msg.payload.stage)
      } else if (msg.type === 'participant:joined') {
        setParticipants((prev) => [...prev, msg.payload])
      } else if (msg.type === 'participant:left') {
        setParticipants((prev) => prev.filter((p) => p.name !== msg.payload.name))
      } else if (msg.type === 'room:closed') {
        setRoomClosed(true)
      } else if (msg.type === 'connect_error') {
        console.error('Socket connection error:', msg.message)
      } else if (msg.type === 'error') {
        console.error('Socket error:', msg.payload.message)
      }
    }

    return () => {
      workerPortRef.current = null
      worker.port.postMessage({ type: 'leave' })
      worker.port.close()
    }
  }, [status, roomId, role, token])

  useEffect(() => {
    if (expiresAt === null) return
    const tick = () => setTimeLeft(Math.max(0, expiresAt - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  if (status === 'loading') {
    return (
      <div className={styles.page}>
        <p className={styles.muted}>Joining room…</p>
      </div>
    )
  }

  if (status === 'not-found') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.heading}>Room not found</h1>
          <p className={styles.body}>This room doesn't exist or has expired.</p>
          <Link to="/" className={styles.link}>
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.heading}>Something went wrong</h1>
          <p className={styles.body}>Could not reach the server. Try again shortly.</p>
          <Link to="/" className={styles.link}>
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.roomLayout}>
      {roomClosed && (
        <div className={styles.modalOverlay}>
          <div className={styles.card}>
            <h2 className={styles.heading}>Session ended</h2>
            <p className={styles.body}>The facilitator has closed the room.</p>
            <Link to="/" className={styles.link}>
              Back to home
            </Link>
          </div>
        </div>
      )}

      <header className={styles.topBar}>
        <h1 className={styles.roomId}>
          Room: {roomId}
          <span className={styles.identity}> — {myName ?? '…'} ({role})</span>
        </h1>
        <div className={styles.stages}>
          {(['planning', 'voting', 'review'] as Stage[]).map((s, i) => (
            <span key={s} className={s === stage ? styles.stageActive : styles.stageInactive}>
              {i > 0 && <span className={styles.stageSep}>›</span>}
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          ))}
        </div>
      </header>

      <div className={styles.roomBody}>
        <main className={styles.mainContent}>
          <div className={styles.mainCenter}>
          {stage === 'planning' && role === 'facilitator' && <PlanningForm />}
          {role === 'facilitator' && (
            <div className={styles.facilitatorActions}>
              {stage === 'planning' && (
                <button
                  className={styles.actionButton}
                  onClick={() => workerPortRef.current?.postMessage({ type: 'start-voting' })}
                >
                  Start voting
                </button>
              )}
              {stage === 'voting' && (
                <button
                  className={styles.actionButton}
                  onClick={() => workerPortRef.current?.postMessage({ type: 'end-voting' })}
                >
                  End voting
                </button>
              )}
              {stage === 'review' && (
                <button
                  className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
                  onClick={() => workerPortRef.current?.postMessage({ type: 'reset' })}
                >
                  Reset
                </button>
              )}
            </div>
          )}
          {stage === 'planning' && role === 'participant' && (
            <p className={styles.muted}>Waiting for the facilitator to set up the vote…</p>
          )}
          </div>
        </main>

        <aside className={`${styles.sidebar} ${sidebarOpen ? '' : styles.sidebarCollapsed}`}>
        <button
          className={styles.sidebarToggle}
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? '›' : '‹'}
        </button>
        {sidebarOpen && (
          <div className={styles.sidebarContent}>
            <div className={styles.timer}>
              <span className={styles.timerLabel}>Closes in</span>
              <span className={styles.timerValue}>
                {expiresAt !== null ? formatTimeLeft(timeLeft) : '—'}
              </span>
            </div>
            <h2 className={styles.sidebarHeading}>Participants ({participants.length})</h2>
            <ul className={styles.participantList}>
              {participants.map((p) => (
                <li key={p.name} className={styles.participantItem}>
                  {p.name}
                  {p.name === myName && <span className={styles.you}> (you)</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        </aside>
      </div>
    </div>
  )
}
