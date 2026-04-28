import { useParams, useSearchParams } from 'react-router-dom'

// Stub — room UI will be implemented once Socket.io integration is in place.
// When joining, pass auth via the socket handshake options, not a 'join' event:
//   io(BACKEND_URL, { auth: { roomId, role, token } })
// For facilitators, retrieve the token from sessionStorage:
//   const token = sessionStorage.getItem(`facilitator-token-${roomId}`)
export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const [searchParams] = useSearchParams()
  const role = searchParams.get('role') ?? 'participant'

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', textAlign: 'center' }}>
      <h1>Room: {roomId}</h1>
      <p>Role: {role}</p>
      <p style={{ color: '#666' }}>Room view coming soon.</p>
    </div>
  )
}
