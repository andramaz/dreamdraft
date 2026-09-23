// Turn the scraped files into the pool the app will actually load.
//
//   node scripts/build-pool.mjs [--version fc27]
//
// Third and last step of the pipeline:
//
//   scrape-ea.mjs      EA's ratings API   -> ea-fc27-raw.json, ea-fc27-players.json
//   backfill-futwiz.mjs Futwiz career DB  -> club-backfill-fc27.json
//   build-pool.mjs     both of those      -> fc27-pool.json
//
// A player with no club cannot take part in a club-based draft, so the rule is
// simply that the pool is the players who have one. That rule also repairs
// itself: EA assigns a club to a transferred player at its next refresh and the
// player returns to the pool on the next scrape, with no mapping to maintain.
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const versionArg = process.argv.indexOf('--version');
const VERSION = (
  versionArg > 0 ? process.argv[versionArg + 1] : 'fc27'
).toLowerCase();

/**
 * A backfilled club needs enough players to be worth rolling in Random Teams.
 * Futwiz places a handful of South Americans in clubs where EA has everyone
 * else already, leaving one-player clubs that would be a dud roll.
 */
const MIN_BACKFILLED_SQUAD = 8;

const players = JSON.parse(
  readFileSync(join(DATA, `ea-${VERSION}-players.json`), 'utf8'),
);

const backfillPath = join(DATA, `club-backfill-${VERSION}.json`);
const backfill = existsSync(backfillPath)
  ? JSON.parse(readFileSync(backfillPath, 'utf8'))
  : {};
if (!existsSync(backfillPath)) {
  console.log(
    'no club-backfill file — run scripts/backfill-futwiz.mjs first\n',
  );
}

// Which backfilled clubs ended up big enough to keep?
const backfilledSize = new Map();
for (const entry of Object.values(backfill)) {
  backfilledSize.set(entry.club, (backfilledSize.get(entry.club) ?? 0) + 1);
}
const keptClubs = new Set(
  [...backfilledSize]
    .filter(([, count]) => count >= MIN_BACKFILLED_SQUAD)
    .map(([club]) => club),
);
const droppedClubs = [...backfilledSize].filter(
  ([club]) => !keptClubs.has(club),
);

let filled = 0;
const pool = [];
let noClub = 0;

for (const player of players) {
  const copy = { ...player };
  if (!copy.club) {
    const found = backfill[String(copy.id)];
    if (found && keptClubs.has(found.club)) {
      copy.club = found.club;
      // Futwiz is not EA, so it has no EA club id to give. The schema will
      // need its own namespace for these; until then the name carries it.
      copy.clubId = null;
      copy.clubSource = 'futwiz';
      filled++;
    }
  }
  if (!copy.club) {
    noClub++;
    continue;
  }
  pool.push(copy);
}

const clubs = new Map();
for (const player of pool)
  clubs.set(player.club, (clubs.get(player.club) ?? 0) + 1);

const outPath = join(DATA, `${VERSION}-pool.json`);
writeFileSync(outPath, JSON.stringify(pool, null, 2), 'utf8');

console.log('--- pool ---');
console.log(`scraped        ${players.length}`);
console.log(`clubs filled   ${filled} from the Futwiz backfill`);
console.log(`dropped        ${noClub} with no club anywhere`);
if (droppedClubs.length) {
  console.log(
    `  of which ${droppedClubs.reduce((n, [, c]) => n + c, 0)} sat in backfilled clubs under ${MIN_BACKFILLED_SQUAD}: ` +
      droppedClubs.map(([club, count]) => `${club} ${count}`).join(', '),
  );
}
console.log(`pool           ${pool.length} players across ${clubs.size} clubs`);
console.log(
  `               ${[...clubs.values()].filter((n) => n >= 18).length} clubs have 18+`,
);
console.log(
  `\n${outPath}  ${(statSync(outPath).size / 1024 / 1024).toFixed(1)} MB`,
);
