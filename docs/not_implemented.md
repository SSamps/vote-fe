# Not Implemented

This document lists production-quality features that have been consciously deferred.
Each item is sound practice and should be added as the project matures — they were
left out to keep the initial build simple, not because they are unimportant.

---

## HTTP security headers

The production Express server (`server.ts`) does not set standard HTTP security
response headers: `Content-Security-Policy`, `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`. These are flagged
by automated security scanners and some enterprise network proxies.

The `helmet` package adds all of them in one line:

```ts
import helmet from 'helmet'
app.use(helmet())
```

The CSP policy will need tuning to allow loading of the app's own scripts and
connecting to the backend WebSocket origin. All other headers can use defaults.

---

## Tests

There are no automated tests. The following are the highest-value targets:

| Target | What to verify |
|---|---|
| `src/pages/LandingPage.tsx` — `extractRoomCode` | Plain code passthrough, URL extraction, trailing slashes, invalid URLs |
| Socket event reducer (once `useRoom` is built) | State transitions for each server event |

Recommended tooling: **Vitest** — zero-config for Vite projects, runs in the same
environment as the app build.

---

## CI pipeline

There is no automated CI. On every push or pull request, the following should run:

```yaml
- npm run typecheck
- npm run lint
- npm run build
```

Recommended: GitHub Actions, triggered on `push` and `pull_request` to `main`.
