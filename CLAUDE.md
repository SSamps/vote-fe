# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

`vote` is the frontend SPA for a voting application, built with React and Vite. It runs entirely in Docker — there is no expectation of running the app directly on the host. A separate backend service (not in this repo) will be integrated later.

## Development workflow

All local development runs inside Docker containers. `npm run` scripts are the entry point for every workflow — do not run `vite` or `docker` commands manually unless debugging a specific script.

**Start dev environment** (watches config files and auto-rebuilds the container on changes):
```bash
npm run dev
```
App is served by the Vite dev server with HMR at `http://localhost:5173`.  
Source files (`src/`, `index.html`, `vite.config.js`) are volume-mounted into the container, so edits take effect immediately without a container rebuild.

**Preview production build** (builds the prod image and serves it via nginx):
```bash
npm run preview
```
Served at `http://localhost:8080`.

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
| `Dockerfile` | `npm run preview` / `npm run prod` | `node:22-alpine` → `nginx:stable-alpine` | Static build via nginx (port 80) |

The prod Dockerfile is a two-stage build — the final image contains only the compiled static files and nginx, no Node.js runtime.

**WSL2 note:** `~/.docker/config.json` must not contain `"credsStore": "desktop.exe"` — Docker Desktop writes this but it breaks builds inside WSL. The file should be `{}`.

## Architecture

This is a plain React SPA. Entry point is `index.html` → `src/main.jsx` (mounts React root) → `src/App.jsx` (top-level component). No routing, state management, or backend integration yet.
