// Refuse a pool that looks like a different game.
//
//   npm run check:shift -w @dreamdraft/backend [-- --version FC27] [--force]
//
// EA's ratings endpoint has no version parameter: it serves whichever game is
// current, so the day FC28 ships, the same url starts returning FC28 and an
// unattended refresh would write it over FC27 under FC27's own label. That is
// exactly how FC26 once ended up in this database.
//
// A mid-season ratings update moves a few hundred players by a point or two
// and nothing else. A change of game moves everything at once. So rather than
// ask a person every week — which teaches them to click yes without reading —
// this compares the incoming pool with what is already stored and stops only
// when the difference is too big to be an update.
//
// Exit code 1 means do not load. `--force` overrides, for the real rollover.
import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../dist/generated/prisma/client.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Anything past these is a different game, not a ratings refresh. */
const LIMITS = {
  /** FC26 -> FC27 was 16,228 -> 17,849, a tenth of the pool. */
  countChange: 0.1,
  /** Salah led FC26, Mbappé leads FC27. An update does not move the top. */
  topPlayer: true,
  /** A transfer window inside one game touches a few percent at most. */
  clubChange: 0.2,
};

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const versionIndex = argv.indexOf('--version');
const version = (
  versionIndex > -1 ? argv[versionIndex + 1] : 'FC27'
).toUpperCase();

interface PoolPlayer {
  id: number;
  name: string;
  rating: number;
  club: string | null;
}

const poolPath = join(ROOT, `data/${version.toLowerCase()}-pool.json`);
if (!existsSync(poolPath)) {
  throw new Error(`${poolPath} is not there — run the scrape and build first`);
}
const incoming: PoolPlayer[] = JSON.parse(readFileSync(poolPath, 'utf8'));

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const stored = await prisma.player.findMany({
  where: { gameVersion: version },
  select: { eaId: true, name: true, rating: true, club: true },
});
await prisma.$disconnect();

if (stored.length === 0) {
  console.log(
    `nothing stored for ${version} yet — nothing to compare, loading is fine`,
  );
  process.exit(0);
}

const best = (players: { name: string; rating: number }[]) =>
  players.reduce((top, player) => (player.rating > top.rating ? player : top));

const storedByEaId = new Map(stored.map((row) => [row.eaId, row]));
let shared = 0;
let moved = 0;
for (const player of incoming) {
  const before = storedByEaId.get(player.id);
  if (!before) continue;
  shared++;
  if (before.club !== player.club) moved++;
}

const countChange = Math.abs(incoming.length - stored.length) / stored.length;
const clubChange = shared === 0 ? 1 : moved / shared;
const topBefore = best(stored);
const topAfter = best(incoming);

const complaints: string[] = [];
if (countChange > LIMITS.countChange) {
  complaints.push(
    `the pool changed size by ${(countChange * 100).toFixed(1)}% (${stored.length} -> ${incoming.length})`,
  );
}
if (LIMITS.topPlayer && topBefore.name !== topAfter.name) {
  complaints.push(
    `the best player changed: ${topBefore.name} ${topBefore.rating} -> ${topAfter.name} ${topAfter.rating}`,
  );
}
if (clubChange > LIMITS.clubChange) {
  complaints.push(
    `${(clubChange * 100).toFixed(1)}% of the players who appear in both changed club (${moved} of ${shared})`,
  );
}

console.log(`--- ${version}: incoming pool against what is stored ---`);
console.log(`players      ${stored.length} -> ${incoming.length}`);
console.log(
  `best rated   ${topBefore.name} ${topBefore.rating} -> ${topAfter.name} ${topAfter.rating}`,
);
console.log(
  `changed club ${moved} of ${shared} shared (${(clubChange * 100).toFixed(1)}%)`,
);

if (complaints.length === 0) {
  console.log('\nlooks like a refresh of the same game — go ahead');
  process.exit(0);
}

console.log('\nthis does not look like a refresh of the same game:');
for (const complaint of complaints) console.log(`  - ${complaint}`);

if (force) {
  console.log('\n--force given, loading anyway');
  process.exit(0);
}
console.log(
  '\nNot loading. If a new game really has shipped, give the new pool its own\n' +
    'gameVersion rather than writing it over this one. To load it here anyway,\n' +
    'run again with --force.',
);
process.exit(1);
