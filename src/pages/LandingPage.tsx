import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './LandingPage.module.css'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:3000'

function extractRoomCode(input: string): string {
  const trimmed = input.trim()
  try {
    const url = new URL(trimmed)
    const match = url.pathname.match(/\/room\/([^/]+)/)
    if (match) return match[1]
  } catch {
    // not a URL — treat as a bare room code
  }
  return trimmed
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [roomCode, setRoomCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch(`${BACKEND_URL}/rooms`, { method: 'POST' })
      if (!res.ok) throw new Error(`Unexpected status ${res.status}`)
      const { roomId, token } = (await res.json()) as { roomId: string; token: string }
      sessionStorage.setItem(`facilitator-token-${roomId}`, token)
      navigate(`/room/${roomId}?role=facilitator`)
    } catch {
      setError('Could not create a room. Is the backend running?')
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const code = extractRoomCode(roomCode)
    if (!code) return
    setJoining(true)
    setError(null)
    try {
      const res = await fetch(`${BACKEND_URL}/rooms/${code}`)
      if (res.status === 404) {
        setError('Room not found. Check the code and try again.')
        return
      }
      if (!res.ok) throw new Error(`Unexpected status ${res.status}`)
      navigate(`/room/${code}`)
    } catch (err) {
      if (err instanceof Error && !err.message.startsWith('Unexpected')) {
        setError('Could not reach the server. Is the backend running?')
      }
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Vote</h1>
        <p className={styles.tagline}>Fast, anonymous voting for your team</p>
      </header>

      <main className={styles.main}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Start a session</h2>
          <p className={styles.cardDescription}>
            Create a room and share the link with your team.
          </p>
          <button
            className={`${styles.button} ${styles.buttonPrimary}`}
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? 'Creating…' : 'Start a session'}
          </button>
        </section>

        <div className={styles.divider}>
          <span>or</span>
        </div>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Join a session</h2>
          <p className={styles.cardDescription}>
            Enter a room code or paste the link from your facilitator.
          </p>
          <form onSubmit={handleJoin} className={styles.joinForm}>
            <input
              type="text"
              placeholder="Room code or URL"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value)}
              disabled={joining}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className={`${styles.button} ${styles.buttonSecondary}`}
              disabled={joining || !roomCode.trim()}
            >
              {joining ? 'Joining…' : 'Join'}
            </button>
          </form>
        </section>

        {error && <p className={styles.error}>{error}</p>}
      </main>
    </div>
  )
}
