# Documentation Overview

This file is the index for everything in `docs/`. Read it first to know which document
to consult for a given question, and to avoid duplicating information that already exists
elsewhere.

---

## Documents in this repo

### [`design.md`](design.md)
**What it covers:** Product design — user roles (facilitator / participant), user flows
(create room, join room), room UI layout, voting and review stages, facilitator controls,
participant identity and naming, and which features are explicitly out of scope.

**Read this when:** You are implementing UI behaviour, need to understand the intended
user experience, or are deciding whether a feature is in scope.

---

### [`project-architecture.md`](project-architecture.md)
**What it covers:** System-level technical architecture — technology choices, the Cloud
Run deployment diagram, REST endpoint contracts (request/response shapes), the Socket.io
connection model (handshake auth, client → server events, server → client events),
environment variables, and the frontend deployment setup.

**Read this when:** You are wiring up REST calls or socket events on the frontend, need
to understand how the two services connect, or are working on the Docker/deployment setup.

**Note:** This document covers the API contract from the frontend's perspective. For
backend implementation details (state model, room lifecycle, server-side processing), see
[`vote-be/docs/architecture.md`](../../vote-be/docs/architecture.md).

---

### [`front-end-guidelines.md`](front-end-guidelines.md)
**What it covers:** Frontend engineering conventions — technology stack, project folder
structure, component patterns, TypeScript conventions, state management approach
(React Context + useReducer), socket lifecycle (per-room, not singleton), custom hook
design, styling rules (CSS Modules, design tokens), import ordering, and a list of
patterns to avoid.

**Read this when:** You are writing any frontend code — components, hooks, or utilities.
These are the rules the codebase is expected to follow.

---

### [`visual-design.md`](visual-design.md)
**What it covers:** Visual language — the full colour palette (CSS custom property tokens
and their hex values), typography (font stack, type scale, weights), spacing system,
border radius and shadow, button variants (primary, secondary, vote buttons), participant
list row design, results display, room layout dimensions, and responsive breakpoint
behaviour.

**Read this when:** You are building or styling any UI component. All colour and spacing
decisions should come from this document, not be invented in component stylesheets.

---

### [`not_implemented.md`](not_implemented.md)
**What it covers:** Features that are consciously deferred — currently: HTTP security
headers (helmet), automated tests, and a CI pipeline. Each entry explains what the
feature is, why it matters, and how it should be implemented when the time comes.

**Read this when:** You are assessing production readiness, planning future work, or
wondering why an otherwise-standard feature is absent.

---

## What lives where — quick reference

| Question | Document |
|---|---|
| What does the room UI look like? | `design.md` |
| What does the facilitator see vs. a participant? | `design.md` |
| What are the REST endpoints and their response shapes? | `project-architecture.md` |
| What socket events does the frontend send and receive? | `project-architecture.md` |
| What environment variables does the frontend need? | `project-architecture.md` |
| How does the frontend Docker image work? | `project-architecture.md` |
| How should I structure a new component? | `front-end-guidelines.md` |
| How do I manage state in the room page? | `front-end-guidelines.md` |
| How should I handle the socket lifecycle? | `front-end-guidelines.md` |
| What colour token should I use for a success indicator? | `visual-design.md` |
| What is the correct padding for a card? | `visual-design.md` |
| Why are there no tests? | `not_implemented.md` |
