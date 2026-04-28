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
  components/         — Reusable presentational components, each in its own sub-folder
    VoteButton/
      VoteButton.tsx
      VoteButton.module.css
  hooks/              — Custom React hooks; encapsulate socket logic and shared business rules
  lib/                — Pure utility functions with no React dependency
  types/              — Shared TypeScript types and interfaces
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
  VoteButton/
    VoteButton.jsx
    VoteButton.module.css
  ParticipantList/
    ParticipantList.jsx
    ParticipantList.module.css
    ParticipantItem.jsx          ← sub-component used only by ParticipantList
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

The room session (participants, stage, votes, my identity) is shared across several components in `RoomPage`. Manage it with a single `useReducer` inside a `RoomContext`, exposed via a custom hook.

```ts
// hooks/useRoom.ts — owns socket lifecycle and all room event handling
export function useRoom(roomId: string, role: Role, token: string | null) {
  const [state, dispatch] = useReducer(roomReducer, initialState)

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      auth: { roomId, role, token: token ?? undefined },
    })

    socket.on('room:state', payload => dispatch({ type: 'ROOM_STATE', payload }))
    socket.on('participant:joined', payload => dispatch({ type: 'PARTICIPANT_JOINED', payload }))
    socket.on('participant:left', payload => dispatch({ type: 'PARTICIPANT_LEFT', payload }))
    socket.on('participant:voted', payload => dispatch({ type: 'PARTICIPANT_VOTED', payload }))
    socket.on('stage:changed', payload => dispatch({ type: 'STAGE_CHANGED', payload }))
    socket.on('results', payload => dispatch({ type: 'RESULTS', payload }))
    socket.on('room:reset', () => dispatch({ type: 'ROOM_RESET' }))
    socket.on('connect_error', err => dispatch({ type: 'CONNECTION_ERROR', message: err.message }))

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [roomId, role, token])

  // action callbacks are derived from the socket ref — see implementation
  ...
}
```

Key points:
- Auth is passed in the `io()` handshake `auth` object, not via a `join` event. The
  server validates the connection before it fires.
- The socket is created inside the effect, not in a singleton. This ensures a fresh
  connection each time a room is visited and a clean teardown when the component unmounts.
- The cleanup **must** call both `removeAllListeners()` and `disconnect()`. Omitting
  `disconnect()` leaves the WebSocket open after navigation.
- `connect_error` carries the rejection message from the server's `io.use()` middleware
  (e.g. "Room not found", "Invalid or expired facilitator token"). Display it to the user.

`RoomPage` calls `useRoom`, passes `state` and the action functions into a `RoomContext`, and child components consume only what they need.

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

Key hooks to build:

| Hook | Responsibility |
|---|---|
| `useRoom(roomId, role, token)` | Creates the socket with handshake auth, subscribes to all room events, tears down on unmount; returns `state`, `vote()`, `endVoting()`, `reset()` |

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

## What to avoid

- Class components
- `any` inline styles that belong in CSS
- Global mutable state outside of React
- Prop drilling past two levels — use Context
- External state libraries
- Component libraries / CSS frameworks
- `useEffect` without a dependency array (almost always a bug)
- Overusing `useMemo` and `useCallback` — profile before optimising
