# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`vote` is the frontend SPA for a voting application, built with React 19 and Vite 8. It runs entirely in Docker — there is no expectation of running the app directly on the host.

## Documentation

See [`docs/documentation-overview.md`](docs/documentation-overview.md) for a description of every document in `docs/`. Read the relevant documents before making changes.

## Development workflow

All local development runs inside Docker containers. `npm run` scripts are the entry point for every workflow — do not run `vite` or `docker` commands manually unless debugging a specific script.

**Run tests** (runs on the host, not inside Docker — requires local `node_modules`):
```bash
npm test              # run all tests once
npm run test:watch    # re-run on file changes
```

Tests use **Vitest** + **React Testing Library**. Three test files cover the key
components — see `src/components/*/  *.test.tsx`.

**Start dev environment** (watches config files and auto-rebuilds the container on changes):
```bash
npm run dev
```
App is served by the Vite dev server with HMR at `http://localhost:5173`.  
Source files (`src/`, `index.html`, `vite.config.ts`) are volume-mounted into the container, so edits take effect immediately without a container rebuild.

**Preview production build** (builds the prod image and serves it via Node.js):
```bash
npm run preview
```
Served at `http://localhost:8080`. Requires a `.env.dev` file (see below).

**Build the prod image and push to registry:**
```bash
npm run prod
```
Update the three `prod:*` script entries in `package.json` to set the correct registry path before using this.

## Docker setup

Two Dockerfiles, two use cases:

| File | Used by | Base | Serves |
|---|---|---|---|
| `docker/dev/Dockerfile` | `npm run dev` | `node:22-alpine` | Vite dev server (port 5173) |
| `Dockerfile` | `npm run preview` / `npm run prod` | `node:22-alpine` (builder) → `node:22-alpine` (runtime) | Compiled SPA via Express server (port 8080) |

The prod Dockerfile is a two-stage build — builder compiles the Vite app and bundles `server.ts` with esbuild; runtime stage contains only `dist/` and `server.cjs`.

**Environment variables for preview:** Create a `.env` file or pass directly to `docker run`. The preview run command does not currently pass an env file — add `--env-file .env.preview` to `preview:dockerRunContainer` if needed. Required variables:
```
VITE_BACKEND_URL=http://localhost:3000
```

**WSL2 note:** `~/.docker/config.json` must not contain `"credsStore": "desktop.exe"` — Docker Desktop writes this but it breaks builds inside WSL. The file should be `{}`.

## Architecture

React 19 SPA with React Router v7. Entry point: `index.html` → `src/main.tsx` → `src/App.tsx` (route definitions) → `src/pages/` (route-level components).
