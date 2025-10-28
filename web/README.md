# Bunker Colab Web Dashboard

React + Vite + Tailwind SPA that provides operators with real-time bunker status, device management, and reporting.

## Prerequisites
- Node.js 18+
- npm 9+

## Local Development
```bash
npm install
cp .env.local.example .env.local   # configure API base URL, map tokens, etc.
npm run dev
```

- Dev server: `http://localhost:5173`
- API base URL defaults to `http://localhost:8000/api`; update `.env.local` when pointing to production.

## Available Scripts
- `npm run dev` — Vite development server with hot module replacement.
- `npm run build` — Production bundle under `dist/`.
- `npm run preview` — Serve the built bundle locally.
- `npm run lint` — Run ESLint on the codebase.

## Project Structure
- `src/pages` — Route-level views (dashboard, bunker detail, provisioning wizard).
- `src/components` — Reusable UI elements.
- `src/services` — API access layer (Axios with generated TypeScript types).
- `src/context` — Global state (auth, configuration).
- `src/hooks` — Reusable logic (polling, form helpers).

## Deployment
Production builds are generated via `npm run build` and published by `scripts/build-web.sh`, which copies `dist/` to `/var/www/bunkercolab` on the deployment host. See the deployment guide for full steps.
