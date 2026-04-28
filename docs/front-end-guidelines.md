# Vote — Front-End Guidelines

This document defines the conventions, technology choices, and patterns that govern all front-end code in this project. Follow it to keep the codebase consistent as it grows.

---

## Technology stack

| Concern | Choice | Rationale |
|---|---|---|
| UI framework | React 19 (functional components only) | Already chosen |
| Build tool | Vite 8 | Already chosen |
| Routing | React Router v6 | Lightweight, declarative, matches the two-route URL scheme |
| Real-time | Socket.io-client | Matches the backend library; handles reconnection automatically |
| Component library | **None** | The app's UI surface is small and well-defined; custom components keep the bundle lean and the design fully controlled |
| CSS approach | CSS Modules + CSS custom properties | Scoped by default, zero runtime cost, no build-time complexity |
| CSS framework | **None** | Tailwind and Bootstrap add tooling complexity and fight the design; CSS Modules are sufficient |
| Global state | React Context + `useReducer` | Sufficient for the single shared state object (room state); no external library needed |
| Type system | TypeScript (strict) | Full type safety; Vite handles transpilation natively with no extra build step |

### Why no component library?

Mantine, Chakra UI, and similar libraries are excellent choices for apps with large, varied UIs. Vote has a small, stable set of components — voting buttons, a participant list, a facilitator toolbar. Building these custom costs very little, gives full visual control, and avoids version-management overhead. Revisit if the component count grows significantly.

---

## Project structure

```
src/
  pages/              — One file per route; maps directly to React Router <Route> entries
    LandingPage.tsx
    RoomPage.tsx
  components/         — Reusable presentational components, each in its own sub-folder
    PlanningForm/
      PlanningForm.tsx
      PlanningForm.module.css
    Sidebar/
      Sidebar.tsx
      Sidebar.module.css
    VotingScale/
      VotingScale.tsx
      VotingScale.module.css
  hooks/              — Custom React hooks
    useRoom.ts        — Worker lifecycle, all room state, action callbacks
  workers/            — SharedWorker and its message type definitions
    roomWorker.ts
    roomWorkerTypes.ts
  lib/                — Pure utility functions with no React dependency
  env.d.ts            — Window.env type augmentation
  vite-env.d.ts       — Vite environment variable type declarations
  index.css           — Global reset + CSS custom properties (design tokens)
  App.tsx             — Route definitions only
  main.tsx            — React root mount; wraps app in BrowserRouter
```

### Pages vs components

- **Pages** (`src/pages/`) are route-level components. They own layout and wire together components and hooks. There is one page per URL path (`LandingPage`, `RoomPage`).
- **Components** (`src/components/`) are reusable UI pieces that receive props and render UI. They have no knowledge of routing or socket state.

A component that is only ever used in one place and is non-trivial can live in its own folder under `components/` anyway — this keeps pages readable.

### TypeScript conventions

- All component files use `.tsx`; all non-JSX files use `.ts`.
- Run `npm run typecheck` (`tsc -b`) to type-check without building.
- Vite transpiles TypeScript at dev and build time; `tsc` is used only for type-checking.
- Prefer explicit prop interfaces over inline types for anything non-trivial:
  ```tsx
  interface VoteButtonProps {
    value: number
    selected: boolean
    disabled: boolean
    onClick: () => void
  }
  export default function VoteButton({ value, selected, disabled, onClick }: VoteButtonProps) {
  ```
- Socket.io event payloads received from the server should be typed to match the backend `ServerToClientEvents` interface. Keep a shared `src/types/` folder for types used across multiple files.

---

## Component conventions

- **Functional components only** — no class components.
- **One component per file**, default-exported.
- **PascalCase filenames** matching the component name: `VoteButton.jsx`, `ParticipantList.jsx`.
- **Co-locate the CSS Module** with the component in the same folder: `VoteButton/VoteButton.module.css`.
- **Props should be explicit** — destructure at the function signature, not inside the body. Keep prop lists short; if a component needs more than ~5 props, consider whether it is doing too much.
- **No prop-drilling beyond two levels** — use Context instead.

### Component folder structure

For anything beyond the simplest component, use a sub-folder:

```
components/
  PlanningForm/
    PlanningForm.tsx
    PlanningForm.module.css
  Sidebar/
    Sidebar.tsx
    Sidebar.module.css
  VotingScale/
    VotingScale.tsx
    VotingScale.module.css
```

---

## State management

Use built-in React hooks throughout. No external state library (no Redux, Zustand, Jotai, etc.).

### Local state

Use `useState` for UI state that belongs to a single component: form inputs, loading flags, error messages, toggled open/closed state.

### Side effects

Use `useEffect` for socket listeners, derived state from props, and cleanup. Always return a cleanup function when subscribing to events.

```js
useEffect(() => {
  socket.on('participant:joined', handler)
  return () => socket.off('participant:joined', handler)
}, [socket, handler])
```

### Shared room state

The room session (participants, stage, votes, my identity) is managed by the `useRoom` hook (`src/hooks/useRoom.ts`). `RoomPage` calls the hook and receives all state and action callbacks directly — no Context or reducer is needed at this scale.

#### Socket connection via SharedWorker

The socket connection is **not** opened directly in a component or hook. Instead, it lives in a `SharedWorker` (`src/workers/roomWorker.ts`) so that all browser tabs open on the same room share one socket. A user who opens the room in multiple tabs appears as a single participant and keeps a consistent identity.

`RoomPage` communicates with the worker through a `MessagePort`:

```ts
// Inside useRoom.ts — RoomPage calls useRoom() and receives state + actions:
const worker = new SharedWorker(
  new URL('../workers/roomWorker.ts', import.meta.url),
  { type: 'module' },
)
worker.port.start()
worker.port.postMessage({ type: 'join', backendUrl: BACKEND_URL, roomId, role, token })

worker.port.onmessage = (e: MessageEvent<WorkerToTabMessage>) => {
  const msg = e.data
  if (msg.type === 'room:state') {
    setStage(msg.payload.stage)
    setQuestions(msg.payload.questions)
    setMyVotes(msg.payload.myVotes)
    // ... etc.
  } else if (msg.type === 'error') {
    setError(msg.payload.message)
    // re-sync votes in case an optimistic update is now wrong
    port.postMessage({ type: 'sync' })
  } else if (msg.type === 'force-leave') {
    setForcedOut(true)  // RoomPage watches this and calls navigate('/')
  }
  // ... etc.
}

// Cleanup on unmount
return () => {
  worker.port.postMessage({ type: 'leave' })
  worker.port.close()
}
```

Message types (`TabToWorkerMessage`, `WorkerToTabMessage`) are defined in
`src/workers/roomWorkerTypes.ts`. Always import from there rather than redefining them.

Key points:
- Send `{ type: 'join', ... }` once on mount; the worker opens the socket or reuses an
  existing one if another tab already has the room open.
- Send `{ type: 'leave' }` in the cleanup function so the worker can reference-count
  ports and disconnect the socket when the last tab leaves.
- The worker itself handles reconnect grace: if the facilitator refreshes, the server
  waits 10 seconds before closing the room, giving the page time to reload and reconnect.
- The facilitator token is read from `localStorage` (not `sessionStorage`) so it is
  available in all tabs.
- `connect_error` and `error` messages from the worker surface rejected actions. On
  receiving `error`, the hook sets an error string for the UI and sends `sync` back to the
  worker to revert any optimistic state update.
- `force-leave` is a worker-to-tab message (not a socket event) broadcast to all ports
  when the facilitator explicitly closes the room via the Leave button. Each tab navigates
  to the landing page on receipt.

#### Tab → Worker message types

```ts
// Send to worker via port.postMessage(...)
{ type: 'join'; backendUrl: string; roomId: string; role: string; token?: string }
{ type: 'leave' }
{ type: 'sync' }          // request worker to re-send lastState to this port (used on error)
{ type: 'start-voting'; questions: Array<{ prompt: string; options: number[] }> }
{ type: 'vote'; questionIndex: number; value: number }
{ type: 'unvote'; questionIndex: number }
{ type: 'end-voting' }
{ type: 'revote' }
{ type: 'reset' }
{ type: 'force-leave' }   // facilitator explicit leave — closes room for all tabs
```

#### Worker → Tab message types

```ts
// Received from worker via port.onmessage
{ type: 'room:state'; payload: RoomStatePayload }
{ type: 'stage:changed'; payload: StageChangedPayload }
{ type: 'participant:joined'; payload: ParticipantView }
{ type: 'participant:left'; payload: { name: string } }
{ type: 'participant:voted'; payload: { name: string; voteCount: number } }
{ type: 'results'; payload: ResultsPayload }
{ type: 'force-leave' }   // navigate all facilitator tabs away
{ type: 'room:closed' }   // show "session ended" modal
{ type: 'connect_error'; message: string }
{ type: 'error'; payload: { message: string } }
```

### Derived values

Use `useMemo` sparingly — only when a computation is genuinely expensive or its reference stability matters. Do not memoize every derived value by default.

### Stable callbacks

Use `useCallback` for event handlers passed as props to child components to avoid unnecessary re-renders. Not needed for handlers used only within the same component.

---

## Styling

### CSS Modules

All component styles use CSS Modules (`.module.css` files). Import as `styles` and reference as `styles.className`:

```jsx
import styles from './VoteButton.module.css'

export default function VoteButton({ value, selected, onClick }) {
  return (
    <button
      className={`${styles.button} ${selected ? styles.selected : ''}`}
      onClick={onClick}
    >
      {value}
    </button>
  )
}
```

For conditional class composition use string interpolation (as above) or a tiny helper like:

```js
const cx = (...classes) => classes.filter(Boolean).join(' ')
// usage: className={cx(styles.button, selected && styles.selected)}
```

Do not install a `classnames` package — this helper is sufficient.

### CSS custom properties (design tokens)

All colour, spacing, and typography values are defined as CSS custom properties in `src/index.css`. **Never hardcode a colour value in a component CSS file** — always use the token:

```css
/* Good */
.button { background: var(--color-primary); }

/* Bad */
.button { background: #2563eb; }
```

See [`visual-design.md`](visual-design.md) for the full token list and their intended usage.

### No inline styles

Avoid inline `style` props except for truly dynamic values that cannot be expressed in CSS — for example, a progress bar width driven by a runtime percentage. For everything else, use a CSS Module class.

### Responsive layout

Use CSS flexbox and grid for layout. The app has one responsive breakpoint at `640px` (tablet/mobile):

- Below 640px: the room sidebar collapses below the voting area (stacked column layout).
- The landing page is already a single column so no change needed there.

Define responsive rules at the bottom of the relevant CSS Module file using `@media (max-width: 640px)`.

---

## Hooks conventions

- Hooks live in `src/hooks/` and are named `use*.js`.
- A hook should have a single clear responsibility.
- Do not put socket event listeners directly in components — always via a custom hook.
- Hooks may use other hooks.

Key hooks:

| Hook | Responsibility |
|---|---|
| `useRoom(roomId, role, token)` | Creates the SharedWorker connection, subscribes to all room events, tears down on unmount; returns room state (`stage`, `questions`, `myVotes`, `results`, `participants`, `myName`, `expiresAt`, `roomClosed`, `forcedOut`, `error`) and action callbacks: `startVoting()`, `vote()`, `unvote()`, `endVoting()`, `revote()`, `reset()`, `forceLeave()`, `clearError()` |

---

## Utilities (`src/lib/`)

Pure functions go in `src/lib/`. No React, no side effects.

---

## Import order

Within each file, order imports as:

1. React
2. Third-party packages
3. Internal — pages, components, hooks, lib (use relative paths)
4. CSS Module (last)

---

## Testing

### Stack

| Tool | Role |
|---|---|
| **Vitest** | Test runner — zero-config with Vite, same transform pipeline |
| **@testing-library/react** | Renders components into a jsdom environment |
| **@testing-library/user-event** | Simulates real user interactions (click, type) |
| **@testing-library/jest-dom** | Extra matchers: `toBeInTheDocument`, `toBeDisabled`, etc. |

Run with `npm test` (once) or `npm run test:watch` (on file changes). Tests run on the
host, not inside Docker.

### What to test

- **UI components** — rendering, user interactions, ARIA attributes.
  Co-locate the test file with the component: `VotingScale/VotingScale.test.tsx`.
- **Pure utility functions** in `src/lib/` — straightforward input/output assertions.

### What not to test

- **`useRoom` and the SharedWorker** — the worker runs in a browser context that jsdom
  cannot replicate. Test the UI components that consume `useRoom`'s output instead.
- **CSS class names** — prefer semantic queries (`getByRole`, `getByText`, `getByLabelText`)
  over class-name assertions. CSS Modules hash class names, making them unstable.

### Key patterns

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

it('fires onVote with the clicked value', async () => {
  const onVote = vi.fn()               // mock function that records calls
  render(<VotingScale ... onVote={onVote} />)

  await userEvent.click(screen.getByRole('button', { name: 'Vote 3' }))

  expect(onVote).toHaveBeenCalledWith(3)
})
```

- Use `screen.getByRole` / `getByText` / `getByLabelText` to find elements — these
  match how assistive technology sees the page.
- Use `screen.queryBy*` (returns `null` rather than throwing) when asserting absence.
- `vi.fn()` creates a mock function. Check calls with `toHaveBeenCalledWith`.
- DOM cleanup between tests is handled automatically by `src/test/setup.ts`.

---

## What to avoid

- Class components
- `any` inline styles that belong in CSS
- Global mutable state outside of React
- Prop drilling past two levels — use Context
- External state libraries
- Component libraries / CSS frameworks
- `useEffect` without a dependency array (almost always a bug)
- Overusing `useMemo` and `useCallback` — profile before optimising
