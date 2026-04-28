import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'

import type { ParticipantView, WorkerToTabMessage, Stage, ResultsPayload } from '../workers/roomWorkerTypes.js'
import PlanningForm from '../components/PlanningForm/PlanningForm.js'
import VotingScale from '../components/VotingScale/VotingScale.js'
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
  const navigate = useNavigate()
  const token = roomId ? localStorage.getItem(`facilitator-token-${roomId}`) : null
  const role = token ? 'facilitator' : 'participant'
  const [status, setStatus] = useState<Status>('loading')
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [stage, setStage] = useState<Stage>('planning')
  const [questions, setQuestions] = useState<Array<{ prompt: string; options: number[] }>>([])
  const [myVotes, setMyVotes] = useState<(number | null)[]>([])
  const [results, setResults] = useState<ResultsPayload | null>(null)
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
        }
        if (msg.payload.stage === 'planning') {
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
        navigate('/')
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
            <Link to="/" className={styles.link}>Back to home</Link>
          </div>
        </div>
      )}

      {showLeaveModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.card}>
            <h2 className={styles.heading}>Leave room?</h2>
            <p className={styles.body}>
              You are the facilitator. Leaving will close the room for all participants.
            </p>
            <div className={styles.modalActions}>
              <button
                className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                onClick={() => workerPortRef.current?.postMessage({ type: 'force-leave' })}
              >
                Leave &amp; close room
              </button>
              <button
                className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
                onClick={() => setShowLeaveModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.roomBody}>
        <div className={styles.mainColumn}>
        <header className={styles.topBar}>
          <button
            className={styles.leaveButton}
            onClick={() => role === 'facilitator' ? setShowLeaveModal(true) : navigate('/')}
          >
            Leave
          </button>
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
        <main className={styles.mainContent}>
          <div className={styles.mainCenter}>
          {stage === 'planning' && role === 'facilitator' && (
            <PlanningForm
              initialQuestions={questions.length > 0 ? questions : undefined}
              onStartVoting={(qs) =>
                workerPortRef.current?.postMessage({ type: 'start-voting', questions: qs })
              }
            />
          )}
          {stage === 'planning' && role === 'participant' && (
            <p className={styles.muted}>Waiting for the facilitator to set up the vote…</p>
          )}
          {stage === 'voting' && (
            <div className={styles.questionStack}>
              {questions.map((q, i) => (
                <VotingScale
                  key={i}
                  prompt={q.prompt}
                  options={q.options}
                  selected={myVotes[i] ?? null}
                  onVote={(value) => {
                    if (value === myVotes[i]) {
                      setMyVotes((prev) => { const next = [...prev]; next[i] = null; return next })
                      workerPortRef.current?.postMessage({ type: 'unvote', questionIndex: i })
                    } else {
                      setMyVotes((prev) => { const next = [...prev]; next[i] = value; return next })
                      workerPortRef.current?.postMessage({ type: 'vote', questionIndex: i, value })
                    }
                  }}
                />
              ))}
            </div>
          )}
          {role === 'facilitator' && stage === 'voting' && (
            <div className={styles.facilitatorActions}>
              <button
                className={styles.actionButton}
                onClick={() => workerPortRef.current?.postMessage({ type: 'end-voting' })}
              >
                End voting
              </button>
              <button
                className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
                onClick={() => workerPortRef.current?.postMessage({ type: 'reset' })}
              >
                Back to planning
              </button>
            </div>
          )}
          {stage === 'review' && (
            <div className={styles.results}>
              {results ? (
                results.questions.map((q, i) => {
                  const maxBreakdownVotes = Math.max(...q.breakdown.map(b => b.votes), 1)
                  return (
                    <div key={i} className={styles.resultCard}>
                      <p className={styles.resultsPrompt}>{q.prompt}</p>
                      {q.average !== null ? (
                        <>
                          <p className={styles.resultsAverage}>{q.average}</p>
                          <p className={styles.resultsMeta}>{q.count} vote{q.count !== 1 ? 's' : ''}</p>
                        </>
                      ) : (
                        <p className={styles.resultsMeta}>No votes were cast.</p>
                      )}
                      {q.count > 0 && (
                        <details className={styles.details}>
                          <summary className={styles.detailsSummary}>Details</summary>
                          <div className={styles.detailsContent}>
                            <div className={styles.breakdown}>
                              <div className={styles.breakdownRow}>
                                <span className={`${styles.breakdownLabel} ${styles.breakdownHeaderCell}`}>Option</span>
                                <span className={styles.breakdownBar} style={{ background: 'transparent' }} />
                                <span className={`${styles.breakdownCount} ${styles.breakdownHeaderCell}`}>Votes</span>
                              </div>
                              {q.breakdown.map((b) => (
                                <div key={b.value} className={styles.breakdownRow}>
                                  <span className={styles.breakdownLabel}>{b.value}</span>
                                  <span className={styles.breakdownBar}>
                                    <span
                                      className={styles.breakdownFill}
                                      style={{ width: `${(b.votes / maxBreakdownVotes) * 100}%` }}
                                    />
                                  </span>
                                  <span className={styles.breakdownCount}>{b.votes}</span>
                                </div>
                              ))}
                            </div>
                            <div className={styles.stats}>
                              <div className={styles.stat}>
                                <span className={styles.statLabel}>Mean</span>
                                <span className={styles.statValue}>{q.average}</span>
                              </div>
                              <div className={styles.stat}>
                                <span className={styles.statLabel}>Median</span>
                                <span className={styles.statValue}>{q.median}</span>
                              </div>
                              <div className={styles.stat}>
                                <span className={styles.statLabel}>Mode</span>
                                <span className={styles.statValue}>{q.mode?.join(', ')}</span>
                              </div>
                            </div>
                          </div>
                        </details>
                      )}
                    </div>
                  )
                })
              ) : (
                <p className={styles.resultsMeta}>Loading results…</p>
              )}
            </div>
          )}
          {role === 'facilitator' && stage === 'review' && (
            <div className={styles.facilitatorActions}>
              <button
                className={styles.actionButton}
                onClick={() => workerPortRef.current?.postMessage({ type: 'revote' })}
              >
                Vote again
              </button>
              <button
                className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
                onClick={() => workerPortRef.current?.postMessage({ type: 'reset' })}
              >
                Reset
              </button>
            </div>
          )}
          </div>
        </main>
        </div>

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
            {stage === 'voting' && (() => {
              const total = questions.length
              const complete = participants.filter((p) => p.voteCount === total).length
              const partial = participants.filter((p) => p.voteCount > 0 && p.voteCount < total).length
              const none = participants.filter((p) => p.voteCount === 0).length
              return (
                <p className={styles.voteCount}>
                  {complete} done
                  {total > 1 && ` · ${partial} in progress`}
                  {` · ${none} remaining`}
                </p>
              )
            })()}
            <ul className={styles.participantList}>
              {participants.map((p) => (
                <li key={p.name} className={styles.participantItem}>
                  <span>
                    {p.name}
                    {p.name === myName && <span className={styles.you}> (you)</span>}
                  </span>
                  {stage === 'voting' && (
                    <span className={styles.voteIndicator} aria-label={`${p.voteCount} of ${questions.length} answered`}>
                      {questions.map((_, i) => (
                        <span key={i} className={i < p.voteCount ? styles.votedDot : styles.unvotedDot} />
                      ))}
                    </span>
                  )}
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
