import { useState, useEffect } from 'react'
import type { ParticipantView, Stage } from '../../workers/roomWorkerTypes.js'
import styles from './Sidebar.module.css'

interface SidebarProps {
  participants: ParticipantView[]
  myName: string | null
  stage: Stage
  questions: Array<{ prompt: string; options: number[] }>
  expiresAt: number | null
}

function formatTimeLeft(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function Sidebar({ participants, myName, stage, questions, expiresAt }: SidebarProps) {
  const [open, setOpen] = useState(true)
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (expiresAt === null) return
    const tick = () => setTimeLeft(Math.max(0, expiresAt - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  return (
    <aside className={`${styles.sidebar} ${open ? '' : styles.sidebarCollapsed}`}>
      <button
        className={styles.sidebarToggle}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {open ? '›' : '‹'}
      </button>
      {open && (
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
                <span className={styles.participantName}>
                  {p.name}
                  {p.role === 'facilitator' && (
                    <span className={styles.facilitatorBadge}>F</span>
                  )}
                  {p.name === myName && <span className={styles.you}> (you)</span>}
                </span>
                {stage === 'voting' && (
                  <span
                    className={styles.voteIndicator}
                    aria-label={`${p.voteCount} of ${questions.length} answered`}
                  >
                    {questions.map((_, i) => (
                      <span
                        key={i}
                        className={i < p.voteCount ? styles.votedDot : styles.unvotedDot}
                      />
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}
