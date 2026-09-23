# Al-Ameen DentoSchedule

A dental class schedule for Al-Ameen University’s College of Dentistry. The live frontend is the imported root-level HTML, CSS, and JavaScript, served through Vite.

## Run & Operate

- `pnpm install --frozen-lockfile` — restore workspace dependencies after importing
- Start the managed `artifacts/dento-schedule: web` workflow to run the frontend schedule (it provides `PORT` and `BASE_PATH`).
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

- `index.html`, `style.css`, `script.js` — live schedule UI, styling, and interactions
- `artifacts/dento-schedule/src/` — separate React implementation, not currently served by the frontend workflow
- `artifacts/dento-schedule/vite.config.ts` — Vite configuration; serves the workspace root via the Replit artifact route
- `artifacts/api-server/src/` — separate Express API service
- `lib/db/` — Drizzle/PostgreSQL database package used by the API

## Architecture decisions

- The imported root-level HTML/CSS/JavaScript is the live frontend; the separate React implementation remains preserved.
- The live frontend does not require the API or database to render. Student account details are stored in the browser's local storage; they are not shared across devices.
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
