# Al-Ameen DentoSchedule

A React/Vite dental class schedule for Al-Ameen University’s College of Dentistry.

## Run & Operate

- `pnpm --filter @workspace/dento-schedule run dev` — run the frontend schedule (the managed Replit workflow provides `PORT` and `BASE_PATH`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (requires `DATABASE_URL`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/dento-schedule/src/App.tsx` — schedule UI, role gateway, admin controls, and modal interactions
- `artifacts/dento-schedule/src/index.css` — frontend styles
- `artifacts/dento-schedule/vite.config.ts` — Vite configuration and Replit artifact routing
- `artifacts/api-server/src/` — separate Express API service
- `lib/db/` — Drizzle/PostgreSQL database package used by the API

## Architecture decisions

- The imported React/Vite frontend remains the primary runnable artifact; the legacy root-level HTML/CSS/JavaScript files are preserved.
- The frontend currently keeps schedule and admin demo state in React state and does not require the API or database to render.
- The API server remains a separate service and must not be started without a configured PostgreSQL `DATABASE_URL`.

## Product

- Students can enter the schedule, browse a ten-day date ribbon, and open subject resources.
- Admins can sign in, edit temporary alerts, post announcements, upload-note placeholders, and add quiz placeholders.

## User preferences

- Preserve the imported project’s existing structure and stack unless a later request calls for a larger change.

## Gotchas

- The frontend Vite config requires `PORT` and `BASE_PATH`; the managed artifact workflow supplies both automatically.
- `pnpm --filter @workspace/dento-schedule run build` requires explicit `PORT` and `BASE_PATH` when run manually, for example `PORT=5173 BASE_PATH=/ ...`.
- The API service requires `DATABASE_URL` at startup because the database package validates it during import.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
