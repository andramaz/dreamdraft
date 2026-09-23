// Pull a player pool from EA's public ratings API — the same endpoint the
// ratings site itself calls. No account needed, but one header is, and the
// run ends with a report a person has to read. See HEADERS and verify().
//
//   node scripts/scrape-ea.mjs [--version FC27] [--out data] [--delay 700] [--max 0]
//
// Two files come out of it. The raw dump is everything EA sent, kept whole so
// a change of mind about which fields matter never means crawling again. The
// normalised file is the same players cut down to the shape the app already
// speaks (`Player` in packages/shared), which is what a seed job will load.
//
// Women's football is left out at the request stage (`gender=0`): EA gives
// women's clubs their own ids but the *same names* — 241 and 116325 are both
// "FC Barcelona" — and this app identifies a club by its name, so mixing the
// two would hand a draft one squad made of both.
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINT = 'https://drop-api.ea.com/rating/ea-sports-fc';
const PAGE_SIZE = 100; // EA's ceiling: 200 is answered with a 400.
// The header the ratings site itself sends. The endpoint has no version
// parameter — it serves whichever game is current — and around a release it
// will hand back the *previous* one to a caller that does not look like the
// site. That is how a whole FC26 pool once got scraped and labelled FC27.
const HEADERS = {
  accept: 'application/json',
  'drop-referrer': 'https://www.ea.com/games/ea-sports-fc/ratings',
};

/** The app's canonical keys; EA's primary positions happen to be the same 12. */
const POSITIONS = new Set([
  'GK',
  'RB',
  'CB',
  'LB',
  'CDM',
  'CM',
  'CAM',
  'RM',
  'LM',
  'RW',
  'LW',
  'ST',
]);

function parseArgs(argv) {
  const args = { out: 'data', delay: 700, max: 0, version: 'FC27' };
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, '');
    const value = argv[index + 1];
    if (key === 'out') args.out = value;
    else if (key === 'delay') args.delay = Number(value);
    else if (key === 'max') args.max = Number(value);
    else if (key === 'version') args.version = value.toUpperCase();
    else if (key) throw new Error(`unknown option: ${argv[index]}`);
  }
  return args;
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * One page, retried with a widening pause. A scrape of ~163 requests will meet
 * a hiccup sooner or later and restarting the whole crawl over one of them
 * would be rude to EA as much as it is slow for us.
 */
async function fetchPage(offset, attempt = 1) {
  const url = `${ENDPOINT}?locale=en&gender=0&limit=${PAGE_SIZE}&offset=${offset}`;
  try {
    const response = await fetch(url, {
      headers: HEADERS,
    });
    if (response.status === 429) {
      const wait = Number(response.headers.get('retry-after') ?? 10) * 1000;
      process.stdout.write(` rate limited, waiting ${wait / 1000}s`);
      await sleep(wait);
      return fetchPage(offset, attempt);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (attempt >= 4) throw new Error(`offset ${offset}: ${error.message}`);
    const wait = 2000 * 2 ** (attempt - 1);
    process.stdout.write(` retry ${attempt} in ${wait / 1000}s`);
    await sleep(wait);
    return fetchPage(offset, attempt + 1);
  }
}

/** EA's record cut down to the app's `Player`, plus the club's id. */
function normalise(item, gameVersion) {
  const position = item.position?.shortLabel;
  const stat = (key) => item.stats?.[key]?.value ?? null;
  return {
    id: item.id,
    // `commonName` is what the player is actually called — "Vini Jr." rather
    // than "Vinicius Jose de Oliveira Junior" — and most players do not have
    // one.
    name:
      item.commonName ??
      [item.firstName, item.lastName].filter(Boolean).join(' '),
    position,
    rating: item.overallRating,
    club: item.team?.label ?? null,
    // Not in the schema yet, but names collide across leagues and the crest is
    // keyed by this, so it is worth carrying from the start.
    clubId: item.team?.id ?? null,
    gameVersion,
    // For a keeper EA puts the goalkeeping card values in these same six
    // slots: pac/sho/pas/dri/def/phy read as DIV/HAN/KIC/REF/SPD/POS.
    pace: stat('pac'),
    shooting: stat('sho'),
    passing: stat('pas'),
    dribbling: stat('dri'),
    defending: stat('def'),
    physical: stat('phy'),
    photoUrl: item.avatarUrl ?? null,
  };
}

function report(players) {
  const byPosition = new Map();
  const byClub = new Map();
  let noPhoto = 0;
  const unknown = new Map();

  for (const player of players) {
    byPosition.set(player.position, (byPosition.get(player.position) ?? 0) + 1);
    if (player.club)
      byClub.set(player.club, (byClub.get(player.club) ?? 0) + 1);
    if (!player.photoUrl) noPhoto++;
    if (!POSITIONS.has(player.position)) {
      unknown.set(player.position, (unknown.get(player.position) ?? 0) + 1);
    }
  }

  const ratings = players.map((player) => player.rating);
  const bigEnough = [...byClub.values()].filter((count) => count >= 18).length;

  console.log('\n--- what came back ---');
  console.log(`players        ${players.length}`);
  console.log(`clubs          ${byClub.size} (${bigEnough} with 18+ players)`);
  console.log(`ratings        ${Math.min(...ratings)}-${Math.max(...ratings)}`);
  console.log(`without photo  ${noPhoto}`);
  console.log(
    'positions      ' +
      [...byPosition]
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => `${key} ${count}`)
        .join('  '),
  );
  if (unknown.size > 0) {
    console.log(
      `\n!! positions the app does not know: ${[...unknown.keys()].join(', ')}`,
    );
    console.log('   these need a mapping before the data can be loaded.');
  }
  const duplicates = players.length - new Set(players.map((p) => p.id)).size;
  if (duplicates > 0) console.log(`\n!! ${duplicates} duplicate ids`);
}

/**
 * The half of the check no program can do.
 *
 * This endpoint has no version parameter and will quietly serve the previous
 * game — a whole FC26 pool was once scraped here, labelled FC27 and loaded
 * into a database before anyone noticed. Nothing in the response says which
 * year it is, but somebody who plays the game can tell at a glance, so print
 * the few rows that give it away and let them.
 */
function verify(players, version) {
  const top = [...players].sort((a, b) => b.rating - a.rating).slice(0, 15);
  console.log(`\n--- does this look like ${version}? ---`);
  for (const [index, player] of top.entries()) {
    const rank = String(index + 1).padStart(2);
    console.log(
      `${rank}. ${player.rating} ${String(player.position).padEnd(4)} ${player.name.padEnd(24)} ${player.club ?? '(no club)'}`,
    );
  }
  for (const club of ['Galatasaray', 'Real Madrid', 'Liverpool']) {
    const whole = players
      .filter((player) => player.club === club)
      .sort((a, b) => b.rating - a.rating);
    // Deep enough to see past the stars. A six-name list once cut a squad off
    // mid-tie and made a correct scrape look wrong.
    const squad = whole.slice(0, 12);
    if (squad.length === 0) continue;
    console.log(`\n${club} (${whole.length} players)`);
    for (const player of squad) {
      console.log(
        `    ${player.rating} ${String(player.position).padEnd(4)} ${player.name}`,
      );
    }
  }
  console.log('\nCheck a transfer or two against the game before loading it.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = resolve(ROOT, args.out);
  mkdirSync(outDir, { recursive: true });

  const first = await fetchPage(0);
  const total =
    args.max > 0 ? Math.min(args.max, first.totalItems) : first.totalItems;
  console.log(
    `EA reports ${first.totalItems} men's players; fetching ${total}`,
  );

  const items = [...first.items];
  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
    // Deliberately serial and paced. The whole pool is ~163 requests; there is
    // nothing to gain from hammering an endpoint that costs us nothing.
    await sleep(args.delay);
    const page = await fetchPage(offset);
    items.push(...page.items);
    const done = Math.min(offset + PAGE_SIZE, total);
    process.stdout.write(`\r  ${done}/${total}   `);
  }
  console.log('');

  const players = items
    .slice(0, total)
    .map((item) => normalise(item, args.version));

  const slug = args.version.toLowerCase();
  const rawPath = join(outDir, `ea-${slug}-raw.json`);
  const outPath = join(outDir, `ea-${slug}-players.json`);
  // The raw file is written compact: pretty-printing 16k records with 40 stats
  // each nearly doubles it and nobody reads it by eye anyway.
  writeFileSync(
    rawPath,
    JSON.stringify({
      source: ENDPOINT,
      gameVersion: args.version,
      fetchedAt: new Date().toISOString(),
      totalItems: first.totalItems,
      items: items.slice(0, total),
    }),
    'utf8',
  );
  writeFileSync(outPath, JSON.stringify(players, null, 2), 'utf8');

  report(players);
  verify(players, args.version);
  const mb = (path) => (statSync(path).size / 1024 / 1024).toFixed(1);
  console.log('\n--- written ---');
  console.log(`${rawPath}  ${mb(rawPath)} MB`);
  console.log(`${outPath}  ${mb(outPath)} MB`);
}

await main();
