# Vote — Technical Architecture

For front-end specific conventions (project structure, state management, styling patterns), see [`front-end-guidelines.md`](front-end-guidelines.md).

---

## Technology choices

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React + Vite | Already chosen |
| Frontend real-time | Socket.io client | Matches server library; handles reconnection automatically |
| Backend runtime | Node.js 22 | Consistent with frontend toolchain |
| Backend framework | Express | Lightweight, well-understood, easy to attach Socket.io to |
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
│  │  nginx (port 80)     │      │  Express + Socket.io     │    │
│  │  Static React SPA    │      │  (port 3000)             │    │
│  └──────────────────────┘      └──────────────────────────┘    │
│           ↕ HTTPS                         ↕ WSS                │
│      Browser clients ──────────────────────────────────────    │
└─────────────────────────────────────────────────────────────────┘
```

The frontend service serves the compiled static bundle. On load, the SPA opens a WebSocket connection directly to the backend service URL (injected at build time via an environment variable).

### Cloud Run and Socket.io: scaling and session affinity

Cloud Run routes HTTP requests to instances without guaranteed stickiness. This affects Socket.io when clients fall back to HTTP long-polling — sequential poll requests may hit different instances and fail.

**Why this is not a concern in practice:**

Socket.io negotiates a WebSocket upgrade during the initial handshake. Once the WebSocket connection is established, it is a persistent TCP connection to a single backend instance — Cloud Run does not re-route it. All subsequent events flow over that connection. HTTP polling is only used in the brief window before the WebSocket upgrade succeeds, or in environments that block WebSockets. Modern browsers and Cloud Run both support WebSockets natively.

**Initial approach:** Set `--max-instances=1` on the backend Cloud Run service. A single instance eliminates any routing concern entirely, keeps the architecture simple, and is safe at the expected scale.

**Future mitigation if scale requires it:** Introduce a Redis instance (Cloud Memorystore) as a shared pub/sub bus and use the `@socket.io/redis-adapter`. This is a well-understood upgrade path and does not require changing the Socket.io event API surface.

---

## Backend project structure

```
backend/
  src/
    index.js          — Entry point: reads PORT from env, calls server.listen()
    app.js            — Creates Express app and Socket.io server; wires middleware,
                        routes, and socket handlers; exports { app, io, server }
    rooms.js          — In-memory room store (Map) and all room mutation functions
    names.js          — Word lists and name assignment / release helpers
    handlers/
      rest.js         — Express route handler functions (POST /rooms, GET /rooms/:roomId,
                        GET /health)
      socket.js       — Socket.io event handler functions (join, vote, end-voting, reset,
                        disconnect)
  package.json
  Dockerfile
  .dockerignore
```

Keep all business logic (room mutations, name assignment, results calculation) in `rooms.js` and `names.js` — the handler files should only translate between the transport layer and these functions.

---

## Initialisation

### Express + Socket.io wiring (`app.js`)

```js
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { restRouter } from './handlers/rest.js'
import { registerSocketHandlers } from './handlers/socket.js'

export function createApp() {
  const app = express()
  const server = createServer(app)

  const io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
  })

  app.use(cors({ origin: process.env.CORS_ORIGIN }))
  app.use(express.json())
  app.use('/', restRouter)

  io.on('connection', socket => registerSocketHandlers(io, socket))

  return { app, io, server }
}
```

### Entry point (`index.js`)

```js
import { createApp } from './app.js'

const { server } = createApp()
const port = process.env.PORT || 3000
server.listen(port, () => console.log(`Listening on port ${port}`))
```

---

## Server-side state model

All state lives in a single `Map<roomId, Room>` held in process memory.

```ts
type Stage = 'voting' | 'review';

type Participant = {
  socketId: string;     // Socket.io socket ID — used to target messages
  name: string;         // adjective-animal, unique within room
  role: 'facilitator' | 'participant';
  vote: number | null;  // null until they vote; hidden from others until review
};

type Room = {
  id: string;
  stage: Stage;
  participants: Map<socketId, Participant>;
};
```

Rooms are created on demand and deleted when the last participant disconnects.

### Room lifecycle

```
POST /rooms
  → room created, stage = 'voting', participants = empty Map

socket 'join' event
  → participant added to room.participants

facilitator emits 'end-voting'
  → stage = 'review'
  → results broadcast

facilitator emits 'reset'
  → all votes cleared (vote = null for every participant)
  → stage = 'voting'

socket disconnect
  → participant removed from room.participants
  → if room.participants is now empty → room deleted from Map
```

---

## REST endpoints

Used for one-off operations that do not require a persistent connection.

### `GET /health`

Cloud Run health check. Returns 200 immediately with no body.

**Response `200`** (empty body or `{ "ok": true }`)

---

### `POST /rooms`

Creates a new room.

**Request:** no body required.

**Response `201`:**
```json
{
  "roomId": "abc123"
}
```

`roomId` is a 6-character URL-safe string generated with `nanoid`. The room is stored in the in-memory Map with `stage: 'voting'` and an empty participants Map.

---

### `GET /rooms/:roomId`

Checks whether a room exists. Used by the landing page join flow to validate a room code before opening a socket connection.

**Response `200`:**
```json
{
  "roomId": "abc123",
  "exists": true
}
```

**Response `404`:**
```json
{
  "error": "Room not found"
}
```

---

## Socket.io events

### Overview of flow

```
1. Client calls POST /rooms (facilitator only) → receives roomId
2. Client opens socket connection (io('BACKEND_URL'))
3. Client emits 'join' with roomId and role
4. Server assigns name, adds participant to room, emits 'room:state' to this socket
5. Server broadcasts 'participant:joined' to all other sockets in the room
6. All subsequent real-time events flow over this connection
```

---

### Client → Server

#### `join`

Sent immediately after the socket connects. Registers the client in the room.

```json
{
  "roomId": "abc123",
  "role": "facilitator" | "participant"
}
```

**Server behaviour:**
1. Look up room by `roomId`. If not found → emit `error` to socket and disconnect.
2. Validate `role` is `'facilitator'` or `'participant'`. If invalid → emit `error`.
3. If `role === 'facilitator'` and the room already has a facilitator → emit `error`.
4. Assign a unique name from the word lists (see [Name generation](#name-generation)).
5. Create a `Participant` record and add it to `room.participants`.
6. Call `socket.join(roomId)` to subscribe this socket to the Socket.io room.
7. Emit `room:state` to this socket only (full snapshot including the assigned name).
8. Broadcast `participant:joined` to all other sockets in the room (`socket.to(roomId).emit(...)`).

---

#### `vote`

Sent when a participant selects or changes their vote.

```json
{
  "value": 3
}
```

Valid values: integers 1–5.

**Server behaviour:**
1. Look up participant by `socket.id`. If not found → ignore.
2. Look up room. If `room.stage !== 'voting'` → ignore silently.
3. Validate `value` is an integer in `[1, 5]`. If invalid → emit `error`.
4. Record the vote: `participant.vote = value`.
5. Broadcast `participant:voted` to all sockets in the room (including sender): `io.to(roomId).emit('participant:voted', { name, hasVoted: true })`.

---

#### `end-voting`

Sent by the facilitator to close voting and move to the review stage.

```json
{}
```

**Server behaviour:**
1. Look up participant by `socket.id`. If not found → ignore.
2. Validate `participant.role === 'facilitator'`. If not → emit `error`.
3. Validate `room.stage === 'voting'`. If already `'review'` → ignore silently.
4. Set `room.stage = 'review'`.
5. Calculate results (see [Results calculation](#results-calculation)).
6. Broadcast `stage:changed` to all sockets in the room.
7. Broadcast `results` to all sockets in the room.

---

#### `reset`

Sent by the facilitator to clear votes and return to the voting stage.

```json
{}
```

**Server behaviour:**
1. Look up participant by `socket.id`. If not found → ignore.
2. Validate `participant.role === 'facilitator'`. If not → emit `error`.
3. Clear all votes: set `vote = null` for every participant in the room.
4. Set `room.stage = 'voting'`.
5. Broadcast `stage:changed` to all sockets in the room.
6. Broadcast `room:reset` to all sockets in the room.

---

### Server → Client

#### `room:state`

Sent to a single socket immediately after they successfully join. Provides a full snapshot of the current room state so the client can render without waiting for incremental events.

```json
{
  "roomId": "abc123",
  "stage": "voting",
  "myName": "gentle-otter",
  "myRole": "facilitator" | "participant",
  "participants": [
    { "name": "gentle-otter", "hasVoted": false, "role": "facilitator" },
    { "name": "radiant-fox",  "hasVoted": true,  "role": "participant" }
  ]
}
```

Vote values are never included here. `hasVoted` is the only vote-related field visible to other participants.

---

#### `participant:joined`

Broadcast to all existing room members when a new participant connects.

```json
{
  "name": "brave-heron",
  "role": "participant",
  "hasVoted": false
}
```

---

#### `participant:left`

Broadcast to all remaining room members when a participant disconnects.

```json
{
  "name": "brave-heron"
}
```

---

#### `participant:voted`

Broadcast to all room members when a participant submits or changes their vote. Contains only the status, not the value.

```json
{
  "name": "radiant-fox",
  "hasVoted": true
}
```

---

#### `stage:changed`

Broadcast to all room members when the facilitator advances or resets the stage.

```json
{
  "stage": "review" | "voting"
}
```

---

#### `results`

Broadcast to all room members when the facilitator ends voting. Sent alongside `stage:changed`.

```json
{
  "average": 3.4,
  "count": 5
}
```

`count` is the number of participants who submitted a vote (some may not have voted before time was called). Future fields: `distribution`, `median`, `mode`.

---

#### `room:reset`

Broadcast to all room members when the facilitator resets the room. Sent alongside `stage:changed`. Signals the client to clear displayed results and re-enable the voting buttons.

```json
{}
```

---

#### `error`

Sent to a single socket when the server rejects an action.

```json
{
  "message": "Not authorised: only the facilitator can end voting"
}
```

Error messages are human-readable. The client may display them directly or use them for debugging.

---

## Name generation

Names follow the pattern `<adjective>-<animal>`. Adjectives must be positive and warm. Names must be unique within a room at any given time.

### Implementation

`names.js` exports two functions:

- `assignName(room)` — selects a random adjective + animal pair not already in use within `room.participants`. Returns the name string.
- `releaseName(room, name)` — called on disconnect; marks the name as available again (achieved simply by removing the participant from the room, since name availability is derived from the current participant set).

Uniqueness check: before assigning, collect all names currently held by `room.participants` values into a Set, then sample from the word list pairs until an unused one is found.

### Sample word lists (expand as needed)

**Adjectives (positive only):**
`bright`, `brave`, `calm`, `daring`, `eager`, `gentle`, `graceful`, `happy`, `jolly`, `keen`, `kind`, `lively`, `merry`, `noble`, `proud`, `radiant`, `serene`, `swift`, `vivid`, `warm`, `wise`, `witty`, `bold`, `clever`, `deft`

**Animals:**
`bear`, `crane`, `deer`, `dolphin`, `eagle`, `falcon`, `finch`, `fox`, `heron`, `ibis`, `jaguar`, `kestrel`, `kite`, `lark`, `lynx`, `marten`, `merlin`, `otter`, `owl`, `panther`, `raven`, `robin`, `seal`, `swift`, `wolf`, `wren`

Total combinations: 25 × 26 = 650. Sufficient for any realistic room size. If a room somehow exhausts all combinations, `assignName` should throw — the caller emits an error and rejects the join.

---

## Results calculation

Triggered when the facilitator emits `end-voting`.

```js
function calculateResults(room) {
  const votes = [...room.participants.values()]
    .map(p => p.vote)
    .filter(v => v !== null)

  if (votes.length === 0) {
    return { average: null, count: 0 }
  }

  const sum = votes.reduce((acc, v) => acc + v, 0)
  const average = Math.round((sum / votes.length) * 10) / 10  // 1 decimal place

  return { average, count: votes.length }
}
```

`average: null` is a valid result (no one voted). The client should handle this case gracefully (e.g. display "–").

---

## Disconnect handling

When a socket disconnects (tab close, network drop, server-initiated), the `disconnect` event fires on the server:

1. Look up participant by `socket.id`. If not found (e.g. they never successfully joined) → do nothing.
2. Remove the participant from `room.participants`.
3. Broadcast `participant:left` to remaining sockets in the room.
4. If `room.participants` is now empty → delete the room from the Map.

**Facilitator disconnect:** If the facilitator disconnects and participants remain, the room stays open but no one can advance the stage. This is an acceptable limitation. A future improvement would be to promote another participant to facilitator or display a notice in the UI.

---

## Error handling

### When to emit `error` vs. log and ignore

| Situation | Action |
|---|---|
| `join` with unknown roomId | emit `error`, call `socket.disconnect()` |
| `join` with invalid role | emit `error` |
| `join` when facilitator slot already filled | emit `error` |
| `vote` with value out of range | emit `error` |
| `end-voting` / `reset` from non-facilitator | emit `error` |
| `vote` / `end-voting` / `reset` from unknown socket | ignore silently |
| `vote` when stage is `review` | ignore silently |
| `end-voting` when already in `review` | ignore silently |

Silent ignores are appropriate for timing races (e.g. a late vote that arrives after the facilitator has already ended voting). Emitting errors for these would create noise on the client.

### Server-side error logging

Log unexpected errors (e.g. name pool exhaustion, unhandled exceptions) to stdout. Cloud Run captures stdout and makes it available in Cloud Logging. Avoid logging every socket event in production — only errors and startup messages.

---

## Environment variables

| Variable | Service | Description |
|---|---|---|
| `VITE_BACKEND_URL` | Frontend (build-time) | Full URL of the backend service, e.g. `https://vote-backend-xxxx.run.app` |
| `PORT` | Backend | Port to listen on (Cloud Run sets this; default to `3000` locally) |
| `CORS_ORIGIN` | Backend | Allowed origin for CORS and Socket.io, e.g. `https://vote-frontend-xxxx.run.app` |

---

## Deployment (Google Cloud Run)

### Backend service

- **Dockerfile:** multi-stage is not necessary (Node.js runtime is needed at runtime). Single stage: `node:22-alpine`, copy `package.json` + `package-lock.json`, run `npm ci --omit=dev`, copy `src/`, set `CMD ["node", "src/index.js"]`.
- **Port:** Cloud Run injects `PORT` (typically `8080`). The app must listen on `process.env.PORT`.
- **Max instances:** `--max-instances=1` — eliminates multi-instance state and Socket.io routing concerns.
- **Min instances:** `0` is fine for development/low traffic. Set to `1` if cold start latency is unacceptable in production (WebSocket upgrade adds to perceived latency).
- **Health check:** Cloud Run checks `/` by default for HTTP services. Add `GET /health → 200` so the health check has a dedicated path.
- **Session affinity:** Not required with `max-instances=1`. If ever scaling beyond 1, enable Cloud Run session affinity and/or add the Redis adapter.

### Frontend service

- Standard nginx serving static files. No special Cloud Run configuration needed.
- Pass `VITE_BACKEND_URL` as a build argument at image build time.

---

## Frontend integration summary

The React app needs two things:

1. **One REST call** — `POST /rooms` on facilitator room creation. `GET /rooms/:roomId` optionally on the join flow to give early feedback if a room code is invalid.

2. **One persistent Socket.io connection** per room session — opened after the room ID is known, kept open for the life of the room visit.

The frontend URL scheme is:
- `/` — landing page (create or join)
- `/room/:roomId` — room view (role determined by how you got there)

When a user navigates to `/room/:roomId` directly (e.g. by pasting the facilitator's link), the app connects as a `participant`. The facilitator flow always goes through the landing page create action.

---

## Out of scope (for now)

- Persistent storage
- Facilitator reconnect / transfer
- Redis adapter for multi-instance scale
- Authentication
- Custom vote scales
