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

### Cloud Run caveat: scaling

Cloud Run can run multiple backend instances. In-memory room state does not survive across instances — a participant and a facilitator could land on different instances and never see each other's events.

**Initial approach:** set `--max-instances=1` on the backend Cloud Run service. This is safe at low scale and keeps the architecture simple.

**Future mitigation if scale requires it:** introduce a Redis instance (Cloud Memorystore) as a shared pub/sub bus and use `socket.io-redis` adapter. This is a well-understood upgrade path and does not require changing the Socket.io API surface.

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

---

## Connection lifecycle

### 1. Create room (facilitator)

```
Client                          Server
  |                               |
  |── REST POST /rooms ──────────>|  Server creates room, returns { roomId }
  |<─ { roomId: "abc123" } ───────|
  |                               |
  |── socket.connect() ──────────>|  WebSocket upgrade
  |── emit('join', { roomId,      |
  |         role:'facilitator' }) |
  |<─ emit('room:state', ...) ────|  Full room snapshot delivered to this socket
```

### 2. Join room (participant)

```
Client                          Server
  |                               |
  |── socket.connect() ──────────>|  WebSocket upgrade
  |── emit('join', { roomId,      |
  |         role:'participant' }) |
  |<─ emit('room:state', ...) ────|  Full room snapshot (stage, participants)
  |                               |
  |                   ── broadcast('participant:joined', { name, hasVoted:false })
  |                               |  → all OTHER sockets in room
```

### 3. Disconnect

When a socket disconnects (tab close, network drop), the server removes the participant from the room and broadcasts `participant:left` to remaining members. If the disconnected user was the facilitator and others remain, the room stays open but no one can advance the stage — this is an acceptable limitation for now.

---

## REST endpoints

These are used for one-off operations that do not require a persistent connection.

### `POST /rooms`

Creates a new room.

**Request:** no body required.

**Response `201`:**
```json
{
  "roomId": "abc123"
}
```

`roomId` is a short random string (e.g. 6 alphanumeric characters, generated with `nanoid`).

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

### Client → Server

#### `join`

Sent immediately after the socket connects. Registers the client in the room.

```json
{
  "roomId": "abc123",
  "role": "facilitator" | "participant"
}
```

Server response: emits `room:state` back to this socket only, then broadcasts `participant:joined` to the rest of the room.

Server assigns a name before emitting `room:state`. The assigned name is included in the `room:state` payload.

---

#### `vote`

Sent when a participant selects or changes their vote.

```json
{
  "value": 3
}
```

Valid values: integers 1–5. The server records the vote against the participant's socket. It does **not** broadcast the vote value — only the voted status.

Ignored if the room's current stage is `review`.

---

#### `end-voting`

Sent by the facilitator to close voting and move to the review stage.

```json
{}
```

Server validates that the sender is the facilitator. Calculates results, transitions stage to `review`, and broadcasts `stage:changed` and `results` to all room members.

---

#### `reset`

Sent by the facilitator to clear votes and return to the voting stage.

```json
{}
```

Server validates that the sender is the facilitator. Clears all votes, transitions stage to `voting`, and broadcasts `stage:changed` and `room:reset` to all room members.

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

## Environment variables

| Variable | Service | Description |
|---|---|---|
| `VITE_BACKEND_URL` | Frontend (build-time) | Full URL of the backend service, e.g. `https://vote-backend-xxxx.run.app` |
| `PORT` | Backend | Port to listen on (Cloud Run sets this to 8080; default to 3000 locally) |
| `CORS_ORIGIN` | Backend | Allowed origin for CORS and Socket.io, e.g. `https://vote-frontend-xxxx.run.app` |

---

## Out of scope (for now)

- Persistent storage
- Facilitator reconnect / transfer
- Redis adapter for multi-instance scale
- Authentication
- Custom vote scales
