// Load a player pool into the database.
//
//   npm run seed -w @dreamdraft/backend            the scraped pool
//   npm run seed -w @dreamdraft/backend -- --fake  the hand-written one
//
// Reads data/fc27-pool.json, which `npm run pool` writes at the repository
// root, and falls back to the fake pool the app shipped with so a fresh
// checkout can fill a database without waiting four minutes for a scrape.
//
// Every row is an upsert on (eaId, gameVersion): a re-scrape updates ratings
// and clubs in place rather than duplicating anyone, and nothing that depends
// on a player's row id breaks.
import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
// The compiled client, not the generated source: Prisma 7 emits TypeScript and
// Node's type stripping will not resolve a `.ts` behind a `.js` specifier. The
// seed script therefore runs after a build — see the `seed` npm script.
import { PrismaClient } from '../dist/generated/prisma/client.js';
import { PLAYERS } from '../dist/players/data/players.data.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const POOL = join(ROOT, 'data/fc27-pool.json');
const CHUNK = 250;

interface PoolPlayer {
  id: number;
  name: string;
  position: string;
  rating: number;
  club: string | null;
  clubId?: number | null;
  clubSource?: string;
  gameVersion: string;
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physical: number | null;
  photoUrl: string | null;
}

function load(): { players: PoolPlayer[]; source: string } {
  const wantsFake = process.argv.includes('--fake');
  if (!wantsFake && existsSync(POOL)) {
    return { players: JSON.parse(readFileSync(POOL, 'utf8')), source: POOL };
  }
  if (!wantsFake) {
    console.log(`${POOL} is not there — seeding the fake pool instead.`);
    console.log(
      'Run `npm run scrape:ea && npm run scrape:clubs && npm run pool` for the real one.\n',
    );
  }
  // The fake pool has no EA ids; its own ids stand in and cannot collide,
  // because EA's start well above the twenty clubs' worth generated here.
  return {
    players: PLAYERS as unknown as PoolPlayer[],
    source: 'the fake pool',
  };
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set — see DEPLOY.md');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const { players, source } = load();

console.log(`seeding ${players.length} players from ${source}`);

const COLUMNS = [
  'eaId',
  'gameVersion',
  'name',
  'position',
  'rating',
  'club',
  'clubId',
  'clubSource',
  'pace',
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'physical',
  'photoUrl',
] as const;

/**
 * One statement per chunk rather than one upsert per player. Prisma's
 * `upsert` is a round trip each, and fifteen thousand of those to a database
 * on the other side of the internet overruns the transaction timeout long
 * before it finishes.
 */
function upsertSql(rows: number): string {
  const values: string[] = [];
  let parameter = 1;
  for (let row = 0; row < rows; row++) {
    const holes = COLUMNS.map(() => `$${parameter++}`);
    values.push(`(${holes.join(',')}, NOW())`);
  }
  const names = COLUMNS.map((column) => `"${column}"`).join(',');
  const updates = COLUMNS.filter(
    (column) => column !== 'eaId' && column !== 'gameVersion',
  )
    .map((column) => `"${column}" = EXCLUDED."${column}"`)
    .join(', ');
  return `
    INSERT INTO "Player" (${names}, "updatedAt")
    VALUES ${values.join(',')}
    ON CONFLICT ("eaId", "gameVersion")
    DO UPDATE SET ${updates}, "updatedAt" = NOW()
  `;
}

const withClub = players.filter((player) => player.club);
if (withClub.length !== players.length) {
  console.log(`${players.length - withClub.length} without a club, left out`);
}

let done = 0;
for (let start = 0; start < withClub.length; start += CHUNK) {
  const batch = withClub.slice(start, start + CHUNK);
  const parameters = batch.flatMap((player) => [
    player.id,
    player.gameVersion,
    player.name,
    player.position,
    player.rating,
    player.club,
    player.clubId ?? null,
    player.clubSource ?? null,
    player.pace,
    player.shooting,
    player.passing,
    player.dribbling,
    player.defending,
    player.physical,
    player.photoUrl,
  ]);
  await prisma.$executeRawUnsafe(upsertSql(batch.length), ...parameters);
  done += batch.length;
  process.stdout.write(`
  ${done}/${withClub.length}   `);
}
console.log('');

const total = await prisma.player.count();
const clubs = await prisma.player.groupBy({ by: ['club'], _count: true });
const versions = await prisma.player.groupBy({
  by: ['gameVersion'],
  _count: true,
});

console.log(`\nrows      ${total}`);
console.log(`clubs     ${clubs.length}`);
for (const version of versions) {
  console.log(`${version.gameVersion.padEnd(10)}${version._count}`);
}

await prisma.$disconnect();
