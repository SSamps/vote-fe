# Vote — Technical Architecture

For front-end conventions (project structure, state management, styling patterns), see
[`front-end-guidelines.md`](front-end-guidelines.md).

For backend implementation details (state model, room lifecycle, name generation, results
calculation, server-side error handling), see
[`vote-be/docs/architecture.md`](../../vote-be/docs/architecture.md).

---

## Technology choices

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React 19 + Vite 8 | Already chosen |
| Frontend real-time | Socket.io client | Matches server library; handles reconnection automatically |
| Backend runtime | Node.js 22 | Consistent with frontend toolchain |
| Backend framework | Express 5 | Lightweight, well-understood, easy to attach Socket.io to |
| Real-time transport | Socket.io (WebSockets) | Bidirectional events; built-in room broadcasting; reconnect/fallback handling |
| Room state | In-process `Map` | Rooms are ephemeral; no persistence needed; simplest possible |
| Name generation | Server-side word lists | Adjective + animal, unique within room |
| Room ID generation | `nanoid` (6 chars) | URL-safe, short, low collision probability at this scale |
| Containerisation | Docker | Already chosen |
| Deployment | Google Cloud Run | Already chosen; both frontend and backend as separate services |

---

## System architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Google Cloud Run                                               │
│                                                                 │
│  ┌──────────────────────┐      ┌──────────────────────────┐    │
│  │  Frontend service    │      │  Backend service         │    │
│  │  Node.js + Express   │      │  Express + Socket.io     │    │
│  │  (port 8080)         │      │  (port 8080)             │    │
│  └──────────────────────┘      └──────────────────────────┘    │
│           ↕ HTTPS                         ↕ WSS                │
│      Browser clients ──────────────────────────────────────    │
└─────────────────────────────────────────────────────────────────┘
```

The frontend service serves the compiled static bundle via a small Express server. On
each request it injects the backend URL into `index.html` at runtime via `window.env` —
the same Docker image can be deployed to different environments without a rebuild. On
load, the SPA reads `window.env.VITE_BACKEND_URL` and opens a WebSocket connection to
the backend service.

### Cloud Run and Socket.io: scaling and session affinity

Cloud Run routes HTTP requests to instances without guaranteed stickiness. This affects
Socket.io when clients fall back to HTTP long-polling — sequential poll requests may hit
different instances and fail.

**Why this is not a concern in practice:**

Socket.io negotiates a WebSocket upgrade during the initial handshake. Once the WebSocket
connection is established, it is a persistent TCP connection to a single backend instance
— Cloud Run does not re-route it. All subsequent events flow over that connection. HTTP
polling is only used in the brief window before the WebSocket upgrade succeeds, or in
environments that block WebSockets. Modern browsers and Cloud Run both support WebSockets
natively.

**Initial approach:** Set `--max-instances=1` on the backend Cloud Run service. A single
instance eliminates any routing concern entirely, keeps the architecture simple, and is
safe at the expected scale.

**Future mitigation if scale requires it:** Introduce a Redis instance (Cloud
Memorystore) as a shared pub/sub bus and use the `@socket.io/redis-adapter`. This is a
well-understood upgrade path and does not require changing the Socket.io event API
surface.

---

## REST endpoints

### `GET /health`

Cloud Run health check. Returns `{ "ok": true }`.

---

### `POST /rooms`

Creates a new room. Rate-limited to 20 requests per minute per IP.

**Response `201`:**
```json
{
  "roomId": "abc123",
  "token": "<facilitator-jwt>"
}
```

`roomId` is a 6-character URL-safe string. `token` is a short-lived JWT scoped to this
room and the facilitator role. Store it in `sessionStorage` keyed by roomId and pass it
in the socket handshake auth when connecting as a facilitator.

---

### `GET /rooms/:roomId`

Checks whether a room exists. Used by the join flow to give early feedback before
opening a socket connection.

**Response `200`:** `{ "roomId": "abc123", "exists": true }`

**Response `404`:** `{ "error": "Room not found" }`

---

## Socket.io connection

Auth is passed in the `io()` handshake `auth` object when the connection is opened.
There is no `join` event — connecting is joining; disconnecting is leaving.

### Handshake auth

```ts
io(BACKEND_URL, {
  auth: {
    roomId: string,
    role: 'facilitator' | 'participant',
    token?: string,   // required when role === 'facilitator'
  }
})
```

If the connection is rejected (room not found, bad token, facilitator slot already
taken), a `connect_error` event fires on the client socket with the rejection message
as `err.message`. Display it to the user.

---

### Client → Server events

| Event | Payload | Description |
|---|---|---|
| `vote` | `{ value: number }` | Submit or change a vote; `value` must be an integer 1–5 |
| `end-voting` | `{}` | Facilitator closes voting and moves to review stage |
| `reset` | `{}` | Facilitator clears all votes and returns to voting stage |

---

### Server → Client events

| Event | Payload | Description |
|---|---|---|
| `room:state` | `{ roomId, stage, myName, myRole, participants[] }` | Full room snapshot sent immediately on connect |
| `participant:joined` | `{ name, role, hasVoted: false }` | Broadcast when a new socket connects to the room |
| `participant:left` | `{ name }` | Broadcast when a socket disconnects |
| `participant:voted` | `{ name, hasVoted: true }` | Broadcast when a vote is submitted; the value is never revealed until review |
| `stage:changed` | `{ stage: 'voting' \| 'review' }` | Broadcast when the facilitator advances or resets the stage |
| `results` | `{ average: number \| null, count: number }` | Broadcast alongside `stage:changed` when voting ends |
| `room:reset` | `{}` | Broadcast alongside `stage:changed` when the room resets |
| `error` | `{ message: string }` | Sent to a single socket when an action is rejected |

The `room:state` payload shape:
```json
{
  "roomId": "abc123",
  "stage": "voting",
  "myName": "gentle-otter",
  "myRole": "facilitator",
  "participants": [
    { "name": "gentle-otter", "role": "facilitator", "hasVoted": false },
    { "name": "radiant-fox",  "role": "participant", "hasVoted": true  }
  ]
}
```

Vote values are never included in any server → client payload. `hasVoted` is the only
vote-related field visible to other participants during voting.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `VITE_BACKEND_URL` | Yes | Full URL of the backend service, e.g. `https://vote-backend-xxxx.run.app`. Injected into `index.html` at request time by `server.ts`. Server throws on startup if missing. |
| `PORT` | No | Port to listen on. Cloud Run sets this automatically; defaults to `8080`. |

---

## Deployment (Google Cloud Run)

- **Docker image:** Two-stage build. Builder stage (`node:22-alpine`) runs `npm ci`,
  compiles the Vite app, and bundles `server.ts` via esbuild → `server.cjs`. Runtime
  stage (`node:22-alpine`) copies `dist/` and `server.cjs`, runs `node server.cjs`.
- **Port:** Cloud Run injects `PORT` (typically `8080`). The server respects it.
- **Environment variables:** Set `VITE_BACKEND_URL` to the backend Cloud Run service URL.
- No special Cloud Run configuration needed — the frontend service is stateless.

---

## Frontend integration summary

The React app needs two things:

1. **Two REST calls** — `POST /rooms` when a facilitator creates a room; `GET /rooms/:roomId`
   on the join flow to validate a room code before connecting.

2. **One persistent Socket.io connection** per room session — opened after the room ID is
   known, kept open for the life of the room visit.

The frontend URL scheme:
- `/` — landing page (create or join)
- `/room/:roomId` — room view

When a user navigates to `/room/:roomId` directly (e.g. by pasting the facilitator's
link), the app connects as a participant. The facilitator flow always goes through the
landing page create action.

---

## Out of scope (for now)

- Persistent storage
- Facilitator reconnect / transfer
- Redis adapter for multi-instance scale
- Authentication
- Custom vote scales
