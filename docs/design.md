# Vote — Application Design

## Purpose

Vote is a lightweight, real-time voting platform for teams. It is designed to run alongside existing communication tools (Google Meet, Zoom, in-person) and let a group vote on arbitrary prompts with minimal friction. There is no account system — rooms are ephemeral, and participants get temporary identities automatically.

## Architecture overview

```
Browser (React SPA)  ←→  Express backend (Node.js)  ←→  (future: persistent storage)
     Docker container           Docker container
         port 5173/80               port 3000
```

Both services are deployed to Google Cloud Run. The frontend is a static SPA served by nginx in production. The backend handles room state and real-time updates (WebSockets or SSE — TBD).

---

## User roles

| Role | How they get it |
|---|---|
| **Facilitator** | Creates the room; there is exactly one per room |
| **Participant** | Joins an existing room via URL or room code |

---

## User flows

### Creating a room

1. Facilitator visits the landing page.
2. Presses **Start a session**.
3. Backend creates a room with a unique key and returns a shareable URL (e.g. `https://vote.example.com/room/abc123`).
4. Facilitator is automatically placed in the room with the facilitator role.

### Joining a room

Two entry paths:
- Paste the facilitator's URL directly into a browser.
- Visit the landing page, enter the room code or URL, and press **Join**.

On join, the backend assigns the participant a random `<adjective>-<animal>` name (e.g. `gentle-otter`, `radiant-fox`). Adjectives are chosen to be positive and pleasant.

---

## Room UI

### Layout

```
┌──────────────────────────────────────────┬───────────────────┐
│  [Facilitator controls — top bar]        │                   │
│                                          │  Participants     │
│                                          │  ─────────────    │
│   Voting options (1 – 5)                 │  gentle-otter ✓   │
│                                          │  radiant-fox  –   │
│   [ 1 ]  [ 2 ]  [ 3 ]  [ 4 ]  [ 5 ]     │  brave-heron  ✓   │
│                                          │                   │
│                                          │                   │
│  [Your name: gentle-otter — top right]   │                   │
└──────────────────────────────────────────┴───────────────────┘
```

### Voting area (all participants, including facilitator)

- Five buttons labelled **1** through **5**.
- Buttons are unselected on entry.
- Selecting a button ticks it; selecting a different button moves the tick (single-select only).
- The participant's current selection is visible only to themselves until results are revealed.

### Participant sidebar (right)

- Lists every participant's name.
- Shows a status indicator per participant: voted (✓) or not yet voted (–).
- Updates in real time as participants join or submit votes.

### Participant identity (top right)

- Each participant sees their own assigned name in the top-right corner of the screen.

---

## Facilitator controls

The facilitator sees an additional control bar at the top of the room. It exposes the current workflow stage and the action to advance it.

### Workflow stages

```
Voting  →  (facilitator presses "End voting")  →  Review  →  (facilitator presses "Reset")  →  Voting
```

#### Voting stage
- All participants (including the facilitator) can submit or change their vote.
- The facilitator sees a button: **End voting**.

#### Review stage
- Voting immediately closes for all participants when the facilitator ends the voting stage.
- Results are revealed to everyone:
  - **Average vote** (mean of all submitted values).
  - *(Future: additional stats and visualisations — e.g. distribution chart, median, mode.)*
- The facilitator sees a button: **Reset** — this clears all votes and returns the room to the Voting stage for a fresh round on a new prompt.

---

## Participant names

Names are generated server-side on join using the pattern `<adjective>-<animal>`. Adjectives should be warm and positive (e.g. *gentle*, *radiant*, *brave*, *kind*, *vivid*). The word list lives in the backend. Names are unique within a room for the duration of the session but are not persisted.

---

## Real-time updates

The backend must push the following events to all connected clients:

| Event | Payload |
|---|---|
| Participant joined | name, initial voted status |
| Participant left | name |
| Participant voted | name, new voted status (not the vote value) |
| Stage changed | new stage (`voting` \| `review`) |
| Results published | average vote (and future stats) |
| Room reset | clears results, returns to voting stage |

Implementation: WebSockets (preferred) or Server-Sent Events + REST for writes.

---

## Out of scope (for now)

- Persistent storage / session history
- Authentication or accounts
- Facilitator transfer
- More than one active vote per room
- Custom vote scales (only 1–5 for now)
- Mobile-specific layout optimisation
