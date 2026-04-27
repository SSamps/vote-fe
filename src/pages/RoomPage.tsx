import { useParams, useSearchParams } from 'react-router-dom'

// Stub — room UI will be implemented once Socket.io integration is in place.
// When joining as facilitator, retrieve the token from sessionStorage:
//   const token = sessionStorage.getItem(`facilitator-token-${roomId}`)
// Then pass it in the socket 'join' event: { roomId, role: 'facilitator', token }
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
