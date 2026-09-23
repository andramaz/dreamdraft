# Deploying DreamDraft

One Vercel project serves the whole app:

```
dreamdraft.vercel.app/           → apps/frontend/dist   (static, on the CDN)
dreamdraft.vercel.app/api/*      → api/[...slug].ts     (one Node function)
```

Same origin on purpose. The frontend already calls relative `/api/...` paths
(`apps/frontend/src/api/client.ts` falls back to an empty base), so there is no
`VITE_API_URL` to set and no CORS to configure in production.

## How the backend runs there

Nothing listens. `apps/backend/src/create-app.ts` builds the Nest application,
and two callers start it:

- `apps/backend/src/main.ts` — local development, calls `listen()`.
- `api/[...slug].ts` — the Vercel function, calls `init()` and hands the
  Express instance each request.

The function imports the **compiled** backend (`apps/backend/dist`), not its
source. Nest resolves its dependencies from the metadata
`emitDecoratorMetadata` writes, and the esbuild pass Vercel runs over `api/`
cannot produce that metadata — `nest build` can. The build command runs before
the functions are bundled, so the output is there when it is needed.

The Nest app is built once per cold start and reused by every request that
instance goes on to serve.

## First deploy

1. **Import the repository** at [vercel.com/new](https://vercel.com/new).
2. **Framework preset:** Other. **Root Directory:** leave at the repository
   root — `vercel.json` already sets the install command, the build command and
   the output directory, so nothing needs filling in by hand.
3. **Node.js version:** 24.x. `engines.node` in the root `package.json` pins
   it, so this should already be right; Project Settings → Build and Deployment
   is where to check.
4. **Environment variables:** none are required. The app ships with the static
   player pool in `apps/backend/src/players/data/players.data.ts`.
5. Deploy, then open `/api/health`. It must answer `{"status":"ok"}`. If it
   does, `/api/players` and the site itself will work too.

Every push to `main` redeploys. Pull requests get their own preview URL.

## Optional environment variables

| Variable       | When it is needed                                                             |
| -------------- | ----------------------------------------------------------------------------- |
| `CORS_ORIGINS` | Only if the frontend is ever hosted somewhere else. Comma separated.          |
| `DATABASE_URL` | Build-order step 5, once Prisma reads from Postgres instead of the fake data. |

## Adding the database (build-order step 5)

Vercel has no database of its own. Use a provider with a free tier —
[Neon](https://neon.tech) fits best here, because it gives a pooled connection
string, and a serverless function opening a fresh Postgres connection per cold
start is exactly what exhausts a small instance.

1. Create the project and copy the **pooled** connection string.
2. Add it as `DATABASE_URL` in Vercel → Settings → Environment Variables.
3. `npx prisma migrate deploy` against it once, from a machine that has the
   URL in a local `.env`.

`prisma generate` already runs in the backend's `prebuild`, and it needs no
`DATABASE_URL` — the schema declares the provider only.

## What this hosting cannot do

- **Cold starts.** The first request after a quiet spell pays ~1-2s to boot
  Nest. Warm requests are immediate.
- **60 seconds per request** on the Hobby plan. Fine for the API, not enough
  for a scrape.
- **No WebSockets.** If a live shared draft room is ever wanted — everyone
  joining from their own device — this plan cannot host it, and the backend
  would have to move to something long-running. The Nest code would not change.
- **Scraping (step 7) does not belong in a function.** Run it as a GitHub
  Actions cron job, or locally, writing into the database. That is what
  `CLAUDE.md` asks for anyway: a seed job, not a per-request fetch.
- **Hobby is non-commercial.** Fine for a portfolio project.

## Running a production build locally

```sh
npm run build
node apps/backend/dist/main   # API on :3000
npm run preview -w @dreamdraft/frontend
```

Note that `nest build` deletes `apps/backend/dist` before writing to it, so do
not run a build while `npm run dev` is watching — it kills the watcher.

## Troubleshooting

- **`/api/*` returns 404.** The function is a catch-all, `api/[...slug].ts`, so
  it answers `/api/health` but not a bare `/api`. Check the Functions tab of
  the deployment: `api/[...slug]` should be listed.
- **The build fails on `@dreamdraft/shared`.** The root `postinstall` builds
  that package; if the install command was overridden in Project Settings so
  that it skips scripts, the shared build never runs.
- **Anything imports `apps/backend/dist` and is not found.** The build command
  did not run, or was changed away from `npm run build` in Project Settings.
