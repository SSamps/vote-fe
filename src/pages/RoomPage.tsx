import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

import styles from './RoomPage.module.css'

const BACKEND_URL =
  window.env?.VITE_BACKEND_URL ?? import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000'

type Status = 'loading' | 'found' | 'not-found' | 'error'

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const token = roomId ? sessionStorage.getItem(`facilitator-token-${roomId}`) : null
  const role = token ? 'facilitator' : 'participant'
  const [status, setStatus] = useState<Status>('loading')

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

  // status === 'found' — stub until room UI is implemented
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', textAlign: 'center' }}>
      <h1>Room: {roomId}</h1>
      <p>Role: {role}</p>
      <p style={{ color: '#666' }}>Room view coming soon.</p>
    </div>
  )
}
