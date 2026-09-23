# FIFA/FC Draft Site — Project Context

## What this is

A FIFA/FC-style player draft website, inspired by Futwiz. Built primarily as a
**practice project**: learning how data-scraping/API-fetching pipelines work,
and getting hands-on with a full-stack setup (NestJS + Prisma + PostgreSQL + React).
Not intended to be a large-scale commercial product — small, personal/portfolio
scale, deployed to a server for fun and to practice deployment.

## Stack

- **Backend:** NestJS (TypeScript)
- **ORM:** Prisma
- **Database:** PostgreSQL on **Neon**, free tier (settled 2026-09-23). The
  "reuse the existing self-hosted instance" plan was dropped: there is no
  working PostgreSQL on the machine — the install at `C:\Program Files  PostgreSQL` has an empty, uninitialised data directory — and no VPS.
- **Frontend:** React (via Vite)
- **i18n:** `react-i18next` — site must support **both Turkish and English**,
  user-switchable. Set this up from the start of scaffolding, not retrofitted
  later. Translation keys in `en.json` / `tr.json`; avoid hardcoded UI strings.
  Backend responses should stay language-agnostic (IDs/keys), translation
  happens frontend-side. Domain data like position abbreviations (ST, CB, etc.)
  needs its own translated label mapping.
- **Deployment:** **settled 2026-09-23** — one Vercel project on the free
  Hobby plan serves both halves: the frontend as static files, the Nest app as
  a single serverless function under `/api`. Railway was the other candidate
  and was dropped because it costs $5/month and this app does not need a
  long-running process — there is no server-side state, the draft engine runs
  in the browser. See `DEPLOY.md`.

## Visual direction

- UI should evoke **dynamic, glossy/shiny Champions League–style FIFA/FC
  interfaces** — think UCL draw show visuals, animated glow/shine effects,
  dramatic team/player reveals. This is a core aesthetic goal, not just
  functional UI. Worth investing in animation/transition polish (card reveals,
  draft picks, fixture draws) once core functionality works.

## Background / context on data sourcing

- Player stats and "head render" photos will be sourced similarly to how
  Futwiz/Sofifa/Fifaindex-style sites do it — via scraping or reverse-engineered
  API endpoints (found via browser DevTools Network tab).
- This is a legal gray area (EA's data/assets, not licensed) but low-risk given
  the small, non-commercial scale. Rate-limit requests, respect robots.txt where
  possible, and cache scraped data instead of live-fetching on every request.
- Sources: **settled 2026-09-23**. **FC27 comes from EA's own public ratings
  API**, the one the ratings site itself calls — verified in DevTools:

  ```
  GET https://drop-api.ea.com/rating/ea-sports-fc?locale=en&limit=100&offset=0
  ```

  No authentication, no cookies, no headers (the site sends an `x-feature`
  header; it changes nothing). `limit` caps at 100 and 200 returns a 400, so a
  full dump is ~179 paged requests. 17,873 players: 16,228 men plus 1,645
  women, selectable with `gender=0` / `gender=1`; `position`, `team` and
  `search` filter too, and an unknown parameter is ignored silently. There is
  **no version parameter** — the endpoint serves whatever game is current, so
  it cannot reach back to FC26.
  - **FC26 and older come from Sofifa**, which keeps every edition. Written as
    a second adapter normalising to the same `Player` shape. Deliberately
    **after** FC27 works end to end: the target shape has to be settled by real
    data first.
  - Rejected: the FUT Web App API (`utas…ea.com`). It needs a real EA account,
    the session tokens are short-lived so it cannot run unattended, and the
    scraping traffic risks a ban on the account.

- The EA response carries much more than the current schema uses, and it is all
  free once the request is made — worth revisiting when the cards get richer
  (build-order step 8): 40 detailed attributes on top of the six summary ones,
  `alternatePositions` (secondary positions), `playerAbilities` (PlayStyles,
  with descriptions), nationality plus flag image, club crest image, height,
  weight, preferred foot, skill moves, weak foot, and a `diff` on every stat
  showing the change since the last ratings update.
- Photos should be cached (own storage/S3-like) rather than hotlinked long-term.
  EA serves them as transparent PNG head renders on `avatarUrl`.

## Build order (agreed approach — follow this sequence)

1. **Scaffold with fake/static data first.** Don't start with scraping — build
   the app shell against a small hand-written JSON set of ~10-20 players
   (name, position, rating, stats, placeholder photoUrl).
2. Backend: NestJS + Prisma set up, `Player` model defined, basic
   `GET /api/players` endpoint (initially can return the fake data before DB
   is wired in).
3. Frontend: React app consuming that endpoint, showing player cards. Set up
   i18n scaffolding at this stage too.
4. Add draft logic (draft config flow below, random selection, team building).
5. Wire Prisma/PostgreSQL in for real — replace fake JSON with DB reads/writes.
   **Done 2026-09-23**: Postgres on Neon's free tier, `PrismaModule` global in
   the Nest graph, `PlayersService` reading from it, and `npm run seed` loading
   `data/fc27-pool.json`. The self-hosted instance this file assumed does not
   exist — there is no working PostgreSQL on the machine and no VPS.
6. Deploy early (even with fake data) to de-risk deployment separately from
   scraping work.
7. **Scraping/data-fetching comes last** — build the scraper once the target
   schema/fields are already known from steps 1-4. Run as a seed/cron job that
   populates the DB periodically, not on-demand per request.
8. Visual polish (glossy/animated UCL-style UI) — layer in once core flows work.

## Draft/tournament flow — user-facing steps

The user goes through a config wizard before a draft starts:

1. **Game version** — FC26 / FC27 / etc. Determines which player pool/stats to use.
2. **Mode** — `match` (no extra config) or `tournament`.
   - `match` means **draft only, no fixtures** — the site builds the squads and
     stops, the games are arranged off-site. It is not limited to two people:
     2-8 may draft (`MATCH_PARTICIPANTS_MAX`). Switching back from a larger
     tournament roster trims it to the cap.
   - If tournament: enter **team count** (2-16) and **format**:
     - `league` (round robin) — asked whether each pair meets **once or home
       and away** (added 2026-09-21). `double` replays the whole calendar with
       the fixtures reversed, so the second half of the season is the first
       half at the other ground and every team hosts every other one. This is
       asked **only for `league`**: a `ucl` league phase stays single, like
       the real competition.
     - `knockout` (single-leg or double-leg/home-away — the choice applies to
       every round, the final included)
     - `ucl` (hybrid: league phase → knockout phase, like the current
       Champions League format) — **settled 2026-09-18**: everyone plays one
       round robin, then the top finishers go into a bracket. How many go
       through is the largest power of two _below_ the team count (6 → 4,
       8 → 4, 9 → 8), so the bracket is always full and the league phase
       always sends someone home. That last part needs at least **3 teams**
       (`UCL_TEAMS_MIN`) — with two, both would qualify, so the wizard blocks
       it. Legs are **not asked** for this format (settled 2026-09-19): the
       knockout rounds are two-legged and the final is a single game, like the
       real competition. Two legs are also what makes the table seeding worth
       playing for — finishing higher means the return leg is at home. See
       `roundLegs`.
   - Fixtures are **always drawn randomly** (decided 2026-09-18). Seeding by
     draft order was dropped: the draft order is itself a random draw, so
     seeding by it would apply the same luck twice. Byes in a knockout are
     drawn too.
   - The one exception is the `ucl` bracket: it is **seeded by the league
     table** (1 v N, 2 v N-1, …), because finishing higher is the whole point
     of playing the league phase. Editing a league score reseeds it, but only
     until the first knockout result is entered.
   - **Results are entered by hand.** The user types the score of every game;
     the table, the bracket and the champion follow from that. A level
     knockout tie asks who won on penalties.
3. **Draft style** — how players are selected:
   - **a) Random teams** — a random club is rolled **for every single pick**;
     the user picks one player from whatever club shows up (decided
     2026-09-17, see the draft-board reference UI).
     - **"Another team" rights**: user picks 3-6 at setup, per participant.
       Spending one rolls a different club.
     - **Repeat teams off**: a club that came up for you never comes up for
       you again (so a squad needs `playersPerTeam` distinct clubs).
     - **Repeat teams on**: the same club may come up again until the user's
       **max players per club** limit is reached. If a club is rolled after
       that limit is full, a warning shows and the picker must roll again —
       **that swap is always free** (decided 2026-09-18): a right is only spent
       when the picker _chooses_ to drop a club they could still have used.
     - No random _player_ auto-pick in this style.
   - **b) Your choice** — user picks both the team and individual players
     freely, up to `playersPerTeam`.
     - **Max players per club** (added 2026-09-19): asked at setup, default 4.
       Setting it to `playersPerTeam` lifts the limit. Players from a club the
       picker has filled stay **on the board, dimmed and unpickable** — the
       point is to show why, not to make them vanish; clicking one says the
       limit for that club is full and to pick from another.
     - No random _player_ auto-pick in this style either — it is called Your
       Choice, so the dice button is not offered.

   There is **no "random pick" button anywhere** on the board any more
   (2026-09-19). Every style that reaches the board either rolls something of
   its own or is explicitly about choosing, and the two styles that pick for
   you (Gambler, Preset) never open the board at all.
   - **c) Random Position** — algo gives a random position + rating range
     constraint, user picks within that constraint, up to `playersPerTeam`.
     - Every pick runs **two draws on screen** (2026-09-19), and the picker
       **presses a button** to start them — nothing happens on its own. The
       position lands first, then the rating band. The answer is already
       computed — the spin is presentation — so the board is held back behind
       a prompt until both settle, and the available count is hidden with it.
       Otherwise the cards would give the draw away.
     - The constraint is **not** capped to a number of candidates: whatever is
       left in the pool at that position and rating band is shown, paged 24 at
       a time.
   - **d) Gambler** (TR "Kumarbaz") — **no picking at all** (settled
     2026-09-19). A formation is drawn per participant and the eleven is filled
     slot by slot; anything past eleven is a random substitute. Renamed from
     "Soldier of Fortune" the same day; the config key is `gambler`.
     - Shapes live in `FORMATIONS` (4-3-3, 4-4-2, 4-2-3-1, 3-5-2). "One of
       every position" is deliberately **not** the rule: there are 12 position
       keys and only eleven slots, and a shape needs two centre-backs more than
       it needs a left-midfielder.
     - Squads are dealt from one shrinking pool, so they never overlap. If a
       position has run out the slot falls back to the nearest role (`NEARBY`)
       rather than leaving a hole.
     - The dealt order is kept all the way to the results screen, which shows
       "starting eleven + formation" above "bench" instead of sorting the squad
       by rating the way the other styles do.
       **"Preset teams" was removed on 2026-09-19.** This is a draft site: a style
       that skips the draft has nothing to offer here, and anyone who wants ready
       squads can set the fixtures up in the game itself. It had also collapsed
       into a worse Gambler once Gambler started dealing whole squads — same
       behaviour, without the formation.

### Pitch view (added 2026-09-19)

Clicking a participant — their card in the draft sidebar, or the button on the
squads screen — opens the squad on a pitch. It is an **overlay**, not a split
screen: the card grid would drop to two columns and the pitch would be too
small to read if they shared the width, and the pitch is consulted between
picks rather than while scanning cards. It closes on an outside click or Esc.

- Shapes live in `FORMATIONS` with pitch coordinates (`x` 0-100 left to right,
  `y` 0 at the goal being attacked, 100 at your own). Eight of them, all
  eleven slots with exactly one keeper.
- The **style** buttons (defensive / balanced / attacking) pick a different
  version of the shape, not a vertical nudge (reworked 2026-09-21 against the
  reference screenshots). The central midfield walks the DM -> CM -> AM ladder,
  full-backs become wing-backs going forward and drop into the defensive line
  going back, and some shapes change character outright: 4-4-2 attacking is a
  midfield diamond, 4-5-1 attacking drops both wide midfielders for a second
  number ten, 3-5-2 attacking turns its wing-backs into wingers. All 24
  (shape x style) layouts are written out in `SHAPES`; `FORMATIONS` exposes the
  balanced one, which is what a Gambler squad is dealt against so changing the
  style on screen never rewrites who was handed out. There is still no tactics
  engine behind any of it, and the keeper never moves.
- `fillShape` places the squad: each slot takes the best-rated player of its
  own position, then the nearest role (`NEARBY`), and is left **dashed and
  empty** if nothing fits. That is the point during a draft — the gaps show
  what you still need. Leftovers become the bench.
- Clicking a slot arms it; clicking a player then pins them there, even out of
  position (shown in magenta). Pinned slots survive a change of shape or style.
- The layout is **view only** — it never constrains the draft. A formation
  requirement stacked on top of Random Position or Random Teams would often be
  impossible to satisfy.
- The choices live in `useDraftFlow`, not in a screen, so a shape arranged
  mid-draft is still there on the squads screen.

  Asked **before** the pick order (moved 2026-09-21), because the style
  decides whether an order is worth asking for at all: **Gambler skips the
  order step entirely** — it deals the squads itself, nobody picks, and the
  deal reads the participant list rather than the pick order, so a wheel
  draw there would be a draw with nothing riding on it.

4. **Draft order** — the user chooses _how_ the pick order is decided
   (revised 2026-09-18, replaces the 2026-09-17 "always random" decision):
   - **Spin the wheel** (`draftOrder.randomize: true`) — the order is drawn
     randomly, slot by slot, on the fortune wheel. The draw always plays out;
     there is no "skip the draw" button.
   - **We decide** (`draftOrder.randomize: false`) — no draw at all. The user
     orders the participants by hand in the wizard (up/down buttons) and that
     order is handed to the draft flow as an explicit list of participant ids.
   - **Pick pattern** is always asked, in both cases:
     - `straight` — order repeats every round (1-2-3, 1-2-3, 1-2-3...)
     - `snake` — order reverses each round (1-2-3, 3-2-1, 1-2-3, 3-2-1...)
5. **Players per team** — user-defined, **min 11, max 18**. Applies across all
   draft styles (single shared config value, asked once, not per-style).

## Draft config schema (working draft, expect to evolve)

```ts
interface DraftConfig {
  gameVersion: 'FC26' | 'FC27';
  mode: 'match' | 'tournament';
  tournament?: {
    teamCount: number;
    format: 'league' | 'knockout' | 'ucl';
    knockoutLegs?: 'single' | 'double'; // knockout only, every round
    leagueLegs?: 'single' | 'double'; // league only, home & away
  };
  draftOrder: {
    randomize: boolean; // true = spin the wheel, false = the user orders by hand
    pickPattern?: 'straight' | 'snake'; // always asked
  };
  draftStyle: 'randomTeams' | 'yourChoice' | 'randomPosition' | 'gambler';
  randomTeams?: {
    rerolls: number; // 3-6, per participant
    allowRepeatTeams: boolean;
    maxPlayersPerTeam: number; // only when allowRepeatTeams
  };
  yourChoice?: {
    maxPlayersPerTeam: number; // 1..playersPerTeam; equal to it means no limit
  };
  playersPerTeam: number; // min 11, max 18
}
```

## Initial Prisma schema (starting point, expect to evolve)

```prisma
model Player {
  id          Int      @id @default(autoincrement())
  name        String
  position    String   // canonical key: GK, CB, ST... (see packages/shared)
  rating      Int
  club        String   // needed for "random teams" draft style
  gameVersion String   // FC26, FC27... — selects the player pool
  pace        Int?
  shooting    Int?
  passing     Int?
  dribbling   Int?
  defending   Int?
  physical    Int?
  photoUrl    String?
  createdAt   DateTime @default(now())
}
```

Actual schema lives in `apps/backend/prisma/schema.prisma`.
Likely future models: `Draft`, `DraftPlayer` (join table linking a draft session
to selected players), `Tournament`, `Match`/`Fixture` — not yet defined, add
when draft/tournament logic is implemented.

## Developer background (for tone/explanation calibration)

- Strong Java background — comparisons to Java/Spring/Hibernate concepts are
  useful reference points when explaining NestJS/Prisma patterns.
- Comfortable with HTML/CSS/JS/Node/PHP fundamentals; still learning
  NestJS/Prisma specifics (has used NestJS before but not deeply familiar).
- Believed they had a PostgreSQL instance running for another project; they do
  not, so this app uses Neon (see Stack).

## Notes / open questions

- Deployment: **settled** — Vercel, one project, see `DEPLOY.md`. The two
  things it cannot do, for when they come up: a request may not run longer
  than 60s (so the scraper in step 7 belongs in a GitHub Actions cron job or a
  local seed run, not in an endpoint), and there are no WebSockets (so a live
  shared draft room would mean moving the backend somewhere long-running —
  the Nest code itself would not change).
- Scraping source: **settled** — EA's public ratings API for FC27, Sofifa for
  FC26, see the data sourcing section above. `scripts/scrape-ea.mjs` pulls the
  pool (`npm run scrape:ea`); output lands in a gitignored `data/`.
- A club is identified by **`clubId`, not its name** (settled 2026-09-23). Two
  names in the men's pool are shared by two real clubs each — Nacional is both
  Uruguay's and Portugal's, Racing Club both Argentina's and Montevideo's —
  and keying by name would hand a draft one squad made of two. The crest image
  is keyed by the id as well.
- **The pipeline is three scripts**, run in order (settled 2026-09-23):

  | Command                | Source           | Output                                     |
  | ---------------------- | ---------------- | ------------------------------------------ |
  | `npm run scrape:ea`    | EA ratings API   | `ea-fc27-raw.json`, `ea-fc27-players.json` |
  | `npm run scrape:clubs` | Futwiz career DB | `club-backfill-fc27.json`                  |
  | `npm run pool`         | both of those    | `fc27-pool.json` — what the app loads      |

  Everything lands in a gitignored `data/`. Nothing is scheduled yet: a cron
  would write files nothing reads, since the API still serves the static fake
  pool. Once Prisma is wired (step 5) the scrape becomes a weekly GitHub
  Actions job writing into Postgres — not a Vercel cron, which cannot run for
  the four minutes it takes.

- **A player with no club is not in the pool** (settled 2026-09-23). EA leaves
  1,515 without one and Futwiz supplies what it can; whoever is still without
  a club is left out.
  - Futwiz is the right source because it is the _same snapshot_: its
    Eredivisie holds Volendam, Heracles and NAC Breda, as FC27 does. Wikipedia
    and football-data.org were both tried and both describe today's squads, so
    each placed only about half and missed the same well-known names.
  - Two kinds of gap, and they need different lookups. A club EA has no licence
    for — Amed, Çorum and Erzurumspor in the Süper Lig, the whole Eredivisie —
    is filled by **walking that league's club pages**. A player EA has simply
    lost track of after a transfer is not in any of those pages at all: he is
    at a club in another league, and only a **name search** finds him. Quinten
    Timber reads as Eredivisie with no club on EA's site and is at Crystal
    Palace in FC27.
  - The rule repairs itself: when EA's next refresh assigns the new club, the
    player returns to the pool on the following scrape. No mapping to keep.
  - A backfilled club needs **8 players** to be kept (`MIN_BACKFILLED_SQUAD`).
    Futwiz placed a handful of South Americans in clubs EA already had whole,
    which would have left one-player clubs for Random Teams to roll.
- The **`Player` primary key** is the autoincrement id, with
  `@@unique([eaId, gameVersion])` beside it (settled 2026-09-23). EA's id alone
  cannot be the key: the same player appears once per game version, so Salah is
  209331 in both FC26 and FC27. The pair is what a re-scrape upserts on.
- EA's ratings API carries the **base ratings only** — the ones Career Mode
  uses. No promo, TOTW or special-card versions; those are a separate endpoint
  (`drop-api.ea.com/team-of-the-week/ea-sports-fc/active-weekly-event`). Every
  stat carries a `diff` showing its change at EA's last ratings refresh, which
  is how a re-scrape can tell who moved. All 16,228 read zero right now, so no
  refresh has landed on FC27 yet.
- UCL format: **settled** — round robin, then a bracket for the top finishers
  (see step 2).
- Fixture order: **settled** — always a random draw, no seeding (see step 2).
  The engine lives in `packages/shared/src/tournament.ts` and is wired to the
  UI: `TournamentScreen` (table + week-by-week fixtures, or the bracket),
  `Bracket`, `StandingsTable`, and `ChampionScreen` for the trophy. The
  celebration replaces the whole tournament screen, so `ChampionScreen` also
  carries a **Tournament summary** toggle (added 2026-09-21) that unfolds
  `TournamentSummary`: the final table plus every match played, grouped by
  week and by knockout round, with legs, aggregates and shootout winners. It
  is **read only** — the tournament is over, and letting a score be edited
  there would silently un-crown the champion. Opening it scrolls the page down
  to the recap and closing it scrolls back up to the trophy: the celebration
  is a screenful on its own, so otherwise the panel opens off-screen.
- Draft order: **settled** — wheel draw or manual ordering, the user picks
  which (see step 3).
- Fake pool is generated (20 clubs x 20 players) in
  `apps/backend/src/players/data/players.data.ts`; clubs need >= 18 players so
  Random Teams works at the max squad size.
