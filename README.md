# DreamDraft

FIFA/FC-style player draft site. Practice project — see [CLAUDE.md](CLAUDE.md) for
goals, build order and draft flow.

## Structure

```
apps/
  backend/    NestJS API (+ Prisma schema)      → http://localhost:3000/api
  frontend/   React + Vite + Tailwind + i18next  → http://localhost:5173
packages/
  shared/     Types, constants and the draft engine used by both
```

## Draft flow

1. **Wizard** — game version → match/tournament → participants → order draw →
   draft style → players per team → summary.
2. **Wheel** — the pick order is always drawn randomly, slot by slot. The
   "skip the show" option runs the same draw without the animation.
3. **Board** — the current picker sees only what their style allows: their
   assigned club (Random Teams), a rolled position + rating band (Random
   Position), their random squad (Soldier of Fortune) or the whole pool (Your
   Choice). Undo and a random-pick button are there for quick runs.
4. **Squads** — final squads per participant with average ratings.

The rules live in [packages/shared/src/draft-engine.ts](packages/shared/src/draft-engine.ts)
as pure functions (`buildSequence`, `initDraft`, `availablePlayers`, `pick`…)
with unit tests, so the backend can reuse them when drafts move into the DB.
Draft state is currently held in the browser only — nothing is persisted yet.

## Getting started

Requires Node 24+.

```bash
npm install                                     # installs all workspaces + builds packages/shared
cp apps/backend/.env.example apps/backend/.env  # adjust if needed
npm run dev                                     # shared (watch) + API + web
```

Vite proxies `/api/*` to the Nest server in dev, so no CORS setup is needed locally.

## Scripts (root)

| Script           | What it does                          |
| ---------------- | ------------------------------------- |
| `npm run dev`    | Run shared watcher, API and frontend  |
| `npm run build`  | Build shared → backend → frontend     |
| `npm run test`   | Run workspace tests (backend: Vitest) |
| `npm run lint`   | Oxlint in every workspace             |
| `npm run format` | Prettier over the repo                |

## API

| Method | Path               | Notes                                               |
| ------ | ------------------ | --------------------------------------------------- |
| GET    | `/api/health`      |                                                     |
| GET    | `/api/players`     | Optional filters: `gameVersion`, `position`, `club` |
| GET    | `/api/players/:id` | 404 if not found                                    |

Currently serves static fake data (`apps/backend/src/players/data/players.data.ts`).

## Database (not wired yet)

Prisma 7 schema is in `apps/backend/prisma/schema.prisma`. When ready:

```sql
CREATE DATABASE dreamdraft;  -- on the existing PostgreSQL instance
```

then set `DATABASE_URL` in `apps/backend/.env` and run
`npm run prisma:migrate -w @dreamdraft/backend`.

## i18n

Translations live in `apps/frontend/src/i18n/locales/{en,tr}.json`. Keys are typed —
a missing or misspelled key fails `tsc`. The backend only returns keys/IDs
(e.g. `position: "ST"`); labels are translated on the frontend.
