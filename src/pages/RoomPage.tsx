import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'

import { useRoom } from '../hooks/useRoom.js'
import Sidebar from '../components/Sidebar/Sidebar.js'
import PlanningForm from '../components/PlanningForm/PlanningForm.js'
import VotingScale from '../components/VotingScale/VotingScale.js'
import type { Stage } from '../workers/roomWorkerTypes.js'
import styles from './RoomPage.module.css'

const BACKEND_URL =
  window.env?.VITE_BACKEND_URL ?? import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000'

type Status = 'loading' | 'found' | 'not-found' | 'error'

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const token = roomId ? localStorage.getItem(`facilitator-token-${roomId}`) : null
  const role = token ? 'facilitator' : 'participant'

  const [status, setStatus] = useState<Status>('loading')
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [copied, setCopied] = useState(false)

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
    return () => { cancelled = true }
  }, [roomId])

  const room = useRoom(status === 'found' ? roomId : undefined, role, token)

  useEffect(() => {
    if (room.forcedOut) navigate('/')
  }, [room.forcedOut, navigate])

  useEffect(() => {
    if (!room.error) return
    const id = setTimeout(room.clearError, 4000)
    return () => clearTimeout(id)
  }, [room.error, room.clearError])

  function copyRoomLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
          <Link to="/" className={styles.link}>Back to home</Link>
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
          <Link to="/" className={styles.link}>Back to home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.roomLayout}>
      {room.roomClosed && (
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
                onClick={room.forceLeave}
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
            <button className={styles.copyButton} onClick={copyRoomLink} title="Copy room link">
              {copied ? 'Copied!' : 'Copy link'}
            </button>
            <h1 className={styles.roomId}>
              Room: {roomId}
              <span className={styles.identity}> — {room.myName ?? '…'} ({role})</span>
            </h1>
            <div className={styles.stages}>
              {(['planning', 'voting', 'review'] as Stage[]).map((s, i) => (
                <span key={s} className={s === room.stage ? styles.stageActive : styles.stageInactive}>
                  {i > 0 && <span className={styles.stageSep}>›</span>}
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </span>
              ))}
            </div>
            <button
              className={styles.leaveButton}
              onClick={() => role === 'facilitator' ? setShowLeaveModal(true) : navigate('/')}
            >
              Leave
            </button>
          </header>

          {room.error && (
            <div className={styles.errorBanner} role="alert">
              <span>{room.error}</span>
              <button className={styles.errorDismiss} onClick={room.clearError} aria-label="Dismiss">
                ×
              </button>
            </div>
          )}

          <main className={styles.mainContent}>
            <div className={styles.mainCenter}>
              {room.stage === 'planning' && role === 'facilitator' && (
                <PlanningForm
                  initialQuestions={room.questions.length > 0 ? room.questions : undefined}
                  onStartVoting={room.startVoting}
                />
              )}
              {room.stage === 'planning' && role === 'participant' && (
                <p className={styles.muted}>Waiting for the facilitator to set up the vote…</p>
              )}
              {room.stage === 'voting' && (
                <div className={styles.questionStack}>
                  {room.questions.map((q, i) => (
                    <VotingScale
                      key={i}
                      prompt={q.prompt}
                      options={q.options}
                      selected={room.myVotes[i] ?? null}
                      onVote={(value) => {
                        if (value === room.myVotes[i]) {
                          room.unvote(i)
                        } else {
                          room.vote(i, value)
                        }
                      }}
                    />
                  ))}
                </div>
              )}
              {role === 'facilitator' && room.stage === 'voting' && (
                <div className={styles.facilitatorActions}>
                  <button className={styles.actionButton} onClick={room.endVoting}>
                    End voting
                  </button>
                  <button
                    className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
                    onClick={room.reset}
                  >
                    Back to planning
                  </button>
                </div>
              )}
              {room.stage === 'review' && (
                <div className={styles.results}>
                  {room.results ? (
                    room.results.questions.map((q, i) => {
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
              {role === 'facilitator' && room.stage === 'review' && (
                <div className={styles.facilitatorActions}>
                  <button className={styles.actionButton} onClick={room.revote}>
                    Vote again
                  </button>
                  <button
                    className={`${styles.actionButton} ${styles.actionButtonSecondary}`}
                    onClick={room.reset}
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          </main>
        </div>

        <Sidebar
          participants={room.participants}
          myName={room.myName}
          stage={room.stage}
          questions={room.questions}
          expiresAt={room.expiresAt}
        />
      </div>
    </div>
  )
}
