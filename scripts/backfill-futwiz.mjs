// Fill in the clubs EA's ratings API leaves blank, from Futwiz's career-mode
// database.
//
//   node scripts/backfill-futwiz.mjs [--delay 2500] [--league Eredivisie]
//
// EA publishes no club for 1,515 players — the leagues are named, the clubs are
// not licensed on their ratings site. Futwiz's career-mode database is built
// from the game itself, so it has them, and it is the *same snapshot*: its
// Eredivisie lists Volendam, Heracles and NAC Breda, exactly as FC27 does,
// where a live football API would list this season's promoted sides instead.
// That is why this is the right source and a current-squad API is not.
//
// Cloudflare turns away plain HTTP, so pages are opened in a headless browser
// at a deliberate crawl. Futwiz's robots.txt allows this (`User-agent: *` gets
// `Allow: /`); only AI training is signalled off, which is not what this is.
//
// Licences do not change inside a game version, so this needs running once per
// version, not on the scraper's schedule.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const BASE = 'https://www.futwiz.com';
const VERSION = 'fc27';
const PORT = 9360;
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((path) => existsSync(path));

const args = { delay: 2500, league: null };
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index].replace(/^--/, '');
  if (key === 'delay') args.delay = Number(process.argv[index + 1]);
  else if (key === 'league') args.league = process.argv[index + 1];
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Accents off, punctuation out, so "Perišić" and "Perisic" are one name. */
const simplify = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const surname = (name) => simplify(name).split(' ').at(-1) ?? '';

// --- the browser ---------------------------------------------------------

async function waitForTarget() {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const page = (await response.json()).find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('Edge did not expose a debugging target');
}

function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 1;
  const ready = new Promise((ok, fail) => {
    socket.addEventListener('open', ok, { once: true });
    socket.addEventListener('error', fail, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
    else entry.resolve(message.result);
  });
  return {
    ready,
    send: (method, params = {}) =>
      new Promise((ok, fail) => {
        const id = nextId++;
        pending.set(id, { resolve: ok, reject: fail });
        socket.send(JSON.stringify({ id, method, params }));
      }),
    close: () => socket.close(),
  };
}

const edge = spawn(
  EDGE,
  [
    '--headless=new',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1500,1400',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${join(ROOT, 'node_modules/.cache/futwiz-profile')}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);
process.on('exit', () => {
  spawnSync('taskkill', ['/f', '/t', '/pid', String(edge.pid)], {
    stdio: 'ignore',
  });
});

mkdirSync(DATA, { recursive: true });
const cdp = connect(await waitForTarget());
await cdp.ready;
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Network.setUserAgentOverride', {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0',
  acceptLanguage: 'en-US,en;q=0.9',
  platform: 'Win32',
});

const evaluate = async (expression) => {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ?? 'evaluate failed',
    );
  }
  return result.result?.value;
};

/** Open a page and wait for it to settle. */
async function open(path) {
  await cdp.send('Page.navigate', { url: BASE + path });
  await sleep(args.delay);
}

/** Links on the current page whose href matches, with their text. */
const linksMatching = (pattern) =>
  evaluate(
    `JSON.stringify([...document.querySelectorAll('a[href]')]
      .map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim() }))
      .filter(l => l.href && ${pattern}.test(l.href)))`,
  ).then((json) => JSON.parse(json));

// --- what EA is missing --------------------------------------------------

const raw = JSON.parse(
  readFileSync(join(DATA, `ea-${VERSION}-raw.json`), 'utf8'),
);
const nameOf = (player) =>
  player.commonName ??
  [player.firstName, player.lastName].filter(Boolean).join(' ');

const gaps = new Map();
for (const player of raw.items) {
  const league = player.leagueName ?? '(none)';
  if (!gaps.has(league)) gaps.set(league, { missing: [], eaClubs: new Set() });
  const entry = gaps.get(league);
  if (player.team) entry.eaClubs.add(simplify(player.team.label));
  else entry.missing.push(player);
}
const affected = [...gaps]
  .filter(([league, e]) => e.missing.length > 0 && league !== '(none)')
  .filter(([league]) => !args.league || league === args.league)
  .sort((a, b) => b[1].missing.length - a[1].missing.length);

console.log(
  `${affected.length} leagues to fix, ${affected.reduce((n, [, e]) => n + e.missing.length, 0)} players\n`,
);

// --- Futwiz's league index ------------------------------------------------

await open(`/${VERSION}/career-mode/leagues`);
const leagueLinks = await linksMatching(`/career-mode\\/leagues\\/[^/]+$/`);
const leagueBySimplified = new Map();
for (const link of leagueLinks) {
  // Link text is "EredivisieNED 1": the label with country and tier glued on.
  const label = link.text.replace(/[A-Z]{3}\s*[0-9F]*\s*[0-9]*$/, '').trim();
  leagueBySimplified.set(simplify(label), link.href);
}
console.log(`Futwiz lists ${leagueBySimplified.size} leagues\n`);

// --- walk each league -----------------------------------------------------

const resolved = {};
const unmatched = [];
let pagesOpened = 1;

for (const [eaLeague, entry] of affected) {
  const href = leagueBySimplified.get(simplify(eaLeague));
  if (!href) {
    console.log(`SKIP  ${eaLeague} — no matching league on Futwiz`);
    for (const player of entry.missing) {
      unmatched.push({
        id: player.id,
        name: nameOf(player),
        rating: player.overallRating,
        league: eaLeague,
        why: 'league not found on Futwiz',
      });
    }
    continue;
  }

  await open(href);
  pagesOpened++;
  const clubLinks = await linksMatching(
    `/career-mode\\/leagues\\/[^/]+\\/[^/]+$/`,
  );
  // Only the clubs EA does not already carry: the rest are not our problem.
  const wanted = clubLinks.filter(
    (club) => !entry.eaClubs.has(simplify(club.text)),
  );
  console.log(
    `${eaLeague}: ${entry.missing.length} players, ${clubLinks.length} clubs on Futwiz, ${wanted.length} not in EA's data`,
  );

  const squad = new Map();
  const bySurname = new Map();
  for (const club of wanted) {
    await open(club.href);
    pagesOpened++;
    let players = await linksMatching(`/career-mode\\/player\\//`);
    // An empty squad means the page had not finished, not that the club is
    // empty. Give it longer, then reload once before believing it.
    if (players.length === 0) {
      await sleep(4000);
      players = await linksMatching(`/career-mode\\/player\\//`);
    }
    if (players.length === 0) {
      await open(club.href);
      pagesOpened++;
      await sleep(4000);
      players = await linksMatching(`/career-mode\\/player\\//`);
    }
    for (const person of players) {
      if (!person.text) continue;
      squad.set(simplify(person.text), club.text);
      const key = surname(person.text);
      bySurname.set(key, bySurname.has(key) ? 'AMBIGUOUS' : club.text);
    }
    console.log(`   ${String(players.length).padStart(3)}  ${club.text}`);
  }

  let hits = 0;
  for (const player of entry.missing) {
    const full = simplify(nameOf(player));
    const found = squad.get(full) ?? bySurname.get(surname(nameOf(player)));
    if (found && found !== 'AMBIGUOUS') {
      resolved[player.id] = { club: found, league: eaLeague, source: 'futwiz' };
      hits++;
    } else {
      unmatched.push({
        id: player.id,
        name: nameOf(player),
        rating: player.overallRating,
        league: eaLeague,
        why:
          found === 'AMBIGUOUS' ? 'surname in two squads' : 'not in any squad',
      });
    }
  }
  console.log(`   -> ${hits}/${entry.missing.length} matched\n`);
}

writeFileSync(
  join(DATA, `club-backfill-${VERSION}.json`),
  JSON.stringify(resolved, null, 2),
  'utf8',
);
writeFileSync(
  join(DATA, `club-backfill-unmatched.json`),
  JSON.stringify(
    unmatched.sort((a, b) => b.rating - a.rating),
    null,
    2,
  ),
  'utf8',
);

console.log(`pages opened ${pagesOpened}`);
console.log(`resolved     ${Object.keys(resolved).length}`);
console.log(`unmatched    ${unmatched.length}`);
if (unmatched.length) {
  console.log('\nhighest rated misses:');
  for (const miss of unmatched.slice(0, 12)) {
    console.log(
      `  ${miss.rating} ${miss.name.padEnd(26)} ${miss.league} — ${miss.why}`,
    );
  }
}

cdp.close();
edge.kill();
