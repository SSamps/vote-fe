# Vote — Application Design

## Purpose

Vote is a lightweight, real-time voting platform for teams. It is designed to run alongside existing communication tools (Google Meet, Zoom, in-person) and let a group vote on arbitrary prompts with minimal friction. There is no account system — rooms are ephemeral, and participants get temporary identities automatically.

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

For colours, spacing, typography, and component visual specifications, see [`visual-design.md`](visual-design.md).

### Layout

```
┌─────────────────────────────────────────┬──────────────────────┐
│  [Leave]  Room: abc123 — gentle-otter   │  ›                   │
│           Planning › Voting › Review    │  Closes in  1:52:33  │
│─────────────────────────────────────────│                       │
│                                         │  Participants (3)    │
│   [Planning / Voting / Review content]  │  ─────────────────   │
│                                         │  gentle-otter (you)  │
│                                         │  radiant-fox  ●●○    │
│                                         │  brave-heron  ●○○    │
└─────────────────────────────────────────┴──────────────────────┘
```

### Top bar

- **Copy link button** (top left): copies the current room URL to the clipboard. Shows "Copied!" for two seconds to confirm.
- **Room identity**: room ID and the user's assigned name and role.
- **Stage indicator**: three labelled steps (Planning, Voting, Review) with the current step highlighted.
- **Leave button** (top right): navigates the user away from the room. For participants it redirects immediately to the landing page. For the facilitator it shows a confirmation modal warning that leaving will close the room for everyone; confirming sends a `close-room` event and redirects all facilitator tabs simultaneously.

### Participant sidebar (right)

- Collapsible — a toggle button at the top collapses it to a narrow strip and expands it again.
- When expanded, shows at the top: a countdown timer displaying the time remaining before the room automatically closes (2 hours from creation).
- Below the timer: every participant's name with a `(you)` tag on the current user. The facilitator is distinguished by a small **F** badge next to their name.
- During the voting stage, shows a row of dots per participant indicating how many questions they have answered (filled dot = answered, empty dot = unanswered). Dots light up left-to-right regardless of which specific question was answered — they represent overall progress.
- A summary line during voting: **X done · Y in progress · Z remaining** (done = all questions answered; in progress = at least one answered but not all; remaining = none answered).
- Updates in real time as participants join or submit votes.

---

## Workflow stages

The room moves through three stages, controlled by the facilitator.

```
Planning  →  (facilitator starts voting)  →  Voting  →  (facilitator ends voting)  →  Review
                                              ↑                                           │
                  (facilitator resets)        └─────── (facilitator votes again) ─────────┘
                         │
                  back to Planning
```

### Planning stage

The facilitator sees a form to set up the vote:

- **One or more questions**, each with a text prompt and a set of numeric scale options.
- Questions can be added or removed. At least one question is required.
- **Start over** button clears the form completely (shown only when the form is pre-populated from a previous session).
- Pressing **Start voting** sends all questions to the server and moves the room to the voting stage.

Participants see a waiting message while the facilitator is in planning.

When the facilitator returns to planning from voting or review, the form is pre-populated with the previous questions so they can make minor adjustments and start a new round without re-entering everything.

### Voting stage

- All questions are displayed simultaneously, stacked vertically.
- Any participant (including the facilitator) can vote on any question.
- Selecting a value on a question records that vote; selecting the same value again removes it (toggle). Selecting a different value changes the vote.
- Each voting button has four explicit visual states: **default** (white, grey border), **hover** (light blue, blue border), **selected** (solid blue), **selected + hover** (darker blue) — so clicking always gives immediate visual feedback.
- Votes are hidden from other participants during this stage — only the number of questions answered per participant is visible.
- Facilitator actions: **End voting** (moves to review) and **Back to planning** (clears votes and returns to planning with the form pre-populated).

### Review stage

- Voting is closed for all participants.
- Results are revealed per question:
  - **Average** (mean, rounded to 1 d.p.) shown prominently.
  - Vote count.
  - A collapsible **Details** panel showing:
    - A horizontal bar chart with the vote count for every configured option (including zero-vote options).
    - **Mean**, **Median**, **Mode** statistics.
- Facilitator actions:
  - **Vote again** — clears all votes, keeps the same questions, returns to the voting stage. Useful for re-running a round (e.g. planning poker re-estimation after discussion).
  - **Reset** — clears votes and questions, returns to planning with the form pre-populated.

---

## Room closure

A room is closed when:

- The facilitator explicitly presses **Leave & close room** in the confirmation modal. This closes the room immediately for all participants with no grace period, and navigates all facilitator tabs to the landing page simultaneously.
- The facilitator closes all their browser tabs or navigates away without using the Leave button. A short grace period (10 seconds) allows for page refreshes — the room only closes if the facilitator does not reconnect within that window.
- The 2-hour automatic expiry fires.
- All participants leave while the facilitator is absent.

When the room closes, all participants see a modal overlay: **"Session ended"** with a link back to the landing page. The modal cannot be dismissed — the room is gone.

---

## Error feedback

If the server rejects an action (e.g. a vote submitted after the stage has changed), a dismissable error banner appears below the top bar. It auto-dismisses after 4 seconds. Connection errors from the socket are surfaced the same way.

---

## Real-time updates

The backend pushes the following events to all connected clients:

| Event | Payload | Description |
|---|---|---|
| `participant:joined` | `{ name, role, voteCount: 0 }` | New participant connected |
| `participant:left` | `{ name }` | Participant disconnected |
| `participant:voted` | `{ name, voteCount }` | Vote submitted or withdrawn; `voteCount` is number of questions answered (value never revealed) |
| `stage:changed` | `{ stage, questions? }` | Stage advanced; `questions` included when entering voting |
| `results` | `{ questions: QuestionResult[] }` | Broadcast alongside `stage:changed` when voting ends |
| `room:reset` | `{}` | Broadcast alongside `stage:changed` when room resets to planning |
| `room:closed` | `{}` | Room closed — triggers the session-ended modal |

Implementation: WebSockets via Socket.io. See [`project-architecture.md`](project-architecture.md) for the full event contract.

---

## Participant names

Names are generated server-side on join using the pattern `<adjective>-<animal>`. Adjectives are warm and positive (e.g. *gentle*, *radiant*, *brave*, *kind*, *vivid*). The word list lives in the backend. Names are unique within a room for the duration of the session but are not persisted.

The facilitator's name is preserved across page refreshes — if they reconnect within the 10-second grace period, their previous name is reused.

---

## Out of scope (for now)

- Persistent storage / session history
- Authentication or accounts
- Facilitator transfer
- Mobile-specific layout optimisation
