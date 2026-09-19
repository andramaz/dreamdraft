import type { KnockoutLegs, TournamentFormat } from './draft-config.js';
import type { Participant } from './draft-engine.js';
import { shuffle, type Rng } from './rng.js';

/** Which half of the tournament a game belongs to. */
export type TournamentPhase = 'league' | 'knockout';

/** One played match. A knockout tie can hold two of them (home & away). */
export interface Fixture {
  id: string;
  phase: TournamentPhase;
  round: number;
  /** Groups the legs of a knockout tie; equals the fixture id in a league. */
  tieId: string;
  leg: 1 | 2;
  homeId: string;
  awayId: string;
  homeGoals: number | null;
  awayGoals: number | null;
}

/** A knockout pairing. Slots stay empty until the previous round is decided. */
export interface KnockoutTie {
  id: string;
  round: number;
  slot: number;
  homeId: string | null;
  awayId: string | null;
}

export interface TournamentState {
  format: TournamentFormat;
  /**
   * The `knockout` format's choice, applied to every round. A `ucl` ignores it
   * and works its legs out per round — see `roundLegs`.
   */
  legs: KnockoutLegs;
  participants: Participant[];
  /** The draw: the league line-up, or the pool the bracket was filled from. */
  order: string[];
  /** Empty until a bracket exists (a `ucl` gets one after its league phase). */
  ties: KnockoutTie[];
  fixtures: Fixture[];
  /** tieId -> participant who won on penalties after a level aggregate. */
  shootoutWinners: Record<string, string>;
  /** `ucl` only: how many league-phase finishers reach the bracket. */
  qualifiers: number;
  /** `ucl` only: who reached it, in finishing order. */
  qualified: string[];
}

export interface StandingsRow {
  participantId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

export class TournamentError extends Error {}

export interface CreateTournamentArgs {
  participants: Participant[];
  /** Draft pick order — the pool the draw is made from. */
  order: string[];
  format: TournamentFormat;
  legs?: KnockoutLegs;
  rng: Rng;
}

export function createTournament({
  participants,
  order,
  format,
  legs = 'single',
  rng,
}: CreateTournamentArgs): TournamentState {
  if (participants.length < 2) {
    throw new TournamentError('A tournament needs at least 2 teams');
  }

  // Who meets whom is always drawn: the draft order was itself random, so
  // seeding by it would just apply the same luck twice (decided 2026-09-18).
  const seeding = shuffle(order, rng);

  const state: TournamentState = {
    format,
    legs,
    participants,
    order: seeding,
    ties: [],
    fixtures: [],
    shootoutWinners: {},
    qualifiers: format === 'ucl' ? qualifierCount(seeding.length) : 0,
    qualified: [],
  };

  if (format === 'knockout') {
    state.ties = buildBracket(seeding);
    return advance(state);
  }

  // A league and a ucl both open with the same round robin.
  state.fixtures = buildLeagueFixtures(seeding);
  return state;
}

/**
 * How many league-phase finishers reach the ucl bracket: the largest power of
 * two below the team count, so the bracket is always full (no byes) and at
 * least one team goes out in the league phase. 6 -> 4, 8 -> 4, 9 -> 8.
 */
export function qualifierCount(teamCount: number): number {
  return 2 ** Math.max(1, Math.ceil(Math.log2(teamCount)) - 1);
}

/** Single round robin (circle method): every pair meets exactly once. */
export function buildLeagueFixtures(teamIds: readonly string[]): Fixture[] {
  const teams: (string | null)[] = [...teamIds];
  if (teams.length % 2 === 1) teams.push(null); // bye slot

  const half = teams.length / 2;
  const rotating = teams.slice(1);
  const fixtures: Fixture[] = [];

  for (let round = 0; round < teams.length - 1; round++) {
    const line = [teams[0]!, ...rotating];
    for (let i = 0; i < half; i++) {
      const home = line[i];
      const away = line[teams.length - 1 - i];
      if (home == null || away == null) continue;
      // Alternate home/away so it does not always fall on the same team.
      const swap = round % 2 === 1 && i === 0;
      const id = `r${round + 1}-m${i + 1}`;
      fixtures.push({
        id,
        phase: 'league',
        round: round + 1,
        tieId: id,
        leg: 1,
        homeId: swap ? away : home,
        awayId: swap ? home : away,
        homeGoals: null,
        awayGoals: null,
      });
    }
    rotating.unshift(rotating.pop()!);
  }

  return fixtures;
}

/**
 * Standard bracket seeding (1 v 16, 8 v 9, …) so byes fall to the top seeds
 * when the team count is not a power of two.
 */
export function seedPositions(size: number): number[] {
  let seeds = [1];
  while (seeds.length < size) {
    const rounds = seeds.length * 2 + 1;
    seeds = seeds.flatMap((seed) => [seed, rounds - seed]);
  }
  return seeds;
}

function buildBracket(teamIds: readonly string[]): KnockoutTie[] {
  const rounds = Math.ceil(Math.log2(teamIds.length));
  const size = 2 ** rounds;
  const positions = seedPositions(size);
  const slots = positions.map((seed) => teamIds[seed - 1] ?? null);

  const ties: KnockoutTie[] = [];
  for (let round = 1; round <= rounds; round++) {
    const tieCount = size / 2 ** round;
    for (let slot = 0; slot < tieCount; slot++) {
      ties.push({
        id: `k${round}-${slot}`,
        round,
        slot,
        homeId: round === 1 ? (slots[slot * 2] ?? null) : null,
        awayId: round === 1 ? (slots[slot * 2 + 1] ?? null) : null,
      });
    }
  }
  return ties;
}

export function leagueFixtures(state: TournamentState): Fixture[] {
  return state.fixtures.filter((fixture) => fixture.phase === 'league');
}

export function knockoutFixtures(state: TournamentState): Fixture[] {
  return state.fixtures.filter((fixture) => fixture.phase === 'knockout');
}

export function leagueRounds(state: TournamentState): number {
  return Math.max(0, ...leagueFixtures(state).map((fixture) => fixture.round));
}

export function knockoutRounds(state: TournamentState): number {
  return Math.max(0, ...state.ties.map((tie) => tie.round));
}

/**
 * How many legs one knockout round is played over.
 *
 * A `ucl` mirrors the real competition (settled 2026-09-19): two legs through
 * the knockout rounds, a single final. Two legs are also what makes the
 * table-seeded bracket worth playing for — finishing higher means the second
 * leg is at home. A plain `knockout` applies whatever the user chose to every
 * round, final included.
 */
export function roundLegs(state: TournamentState, round: number): KnockoutLegs {
  if (state.format !== 'ucl') return state.legs;
  return round === knockoutRounds(state) ? 'single' : 'double';
}

export function totalRounds(state: TournamentState): number {
  return state.format === 'league'
    ? leagueRounds(state)
    : knockoutRounds(state);
}

/** Every league-phase game has a score. Always false for a pure knockout. */
export function leaguePhaseComplete(state: TournamentState): boolean {
  const league = leagueFixtures(state);
  return (
    league.length > 0 &&
    league.every(
      (fixture) => fixture.homeGoals !== null && fixture.awayGoals !== null,
    )
  );
}

/** Which half of a `ucl` the user is looking at right now. */
export function currentPhase(state: TournamentState): TournamentPhase {
  if (state.format === 'league') return 'league';
  if (state.format === 'knockout') return 'knockout';
  return state.ties.length > 0 ? 'knockout' : 'league';
}

/** True once a knockout result has been entered — the bracket is then fixed. */
function knockoutStarted(state: TournamentState): boolean {
  return (
    Object.keys(state.shootoutWinners).length > 0 ||
    knockoutFixtures(state).some(
      (fixture) => fixture.homeGoals !== null || fixture.awayGoals !== null,
    )
  );
}

/** Goals scored by each side of a tie, across both legs. */
export function tieAggregate(
  state: TournamentState,
  tie: KnockoutTie,
): { home: number; away: number; played: boolean } {
  const legs = state.fixtures.filter((fixture) => fixture.tieId === tie.id);
  let home = 0;
  let away = 0;
  let played = legs.length > 0;

  for (const leg of legs) {
    if (leg.homeGoals === null || leg.awayGoals === null) {
      played = false;
      continue;
    }
    if (leg.homeId === tie.homeId) {
      home += leg.homeGoals;
      away += leg.awayGoals;
    } else {
      home += leg.awayGoals;
      away += leg.homeGoals;
    }
  }

  return { home, away, played };
}

/** Winner of a tie, or undefined while it is still open. */
export function tieWinner(
  state: TournamentState,
  tie: KnockoutTie,
): string | undefined {
  // Only the first round can have a bye. Later on an empty slot means the tie
  // feeding it is still open, so nobody has won this one yet.
  if (tie.round === 1 && tie.homeId && !tie.awayId) return tie.homeId;
  if (!tie.homeId || !tie.awayId) return undefined;

  const { home, away, played } = tieAggregate(state, tie);
  if (!played) return undefined;
  if (home > away) return tie.homeId;
  if (away > home) return tie.awayId;
  return state.shootoutWinners[tie.id];
}

/** Fills the next rounds from decided ties and creates their fixtures. */
export function advance(state: TournamentState): TournamentState {
  if (state.format === 'league') return state;
  const opened = state.format === 'ucl' ? openKnockoutPhase(state) : state;
  if (opened.ties.length === 0) return opened;
  return advanceBracket(opened);
}

/**
 * ucl: once every league game has a score, the top `qualifiers` go into a
 * bracket seeded by the table (1 v N, 2 v N-1, …). Unlike the league draw this
 * half is *not* drawn — finishing higher is what the league phase is for
 * (decided 2026-09-18). Editing a league score reseeds the bracket, but only
 * while no knockout result has been entered yet.
 */
function openKnockoutPhase(state: TournamentState): TournamentState {
  if (knockoutStarted(state)) return state;

  if (!leaguePhaseComplete(state)) {
    if (state.ties.length === 0) return state;
    return {
      ...state,
      ties: [],
      qualified: [],
      fixtures: leagueFixtures(state),
    };
  }

  const qualified = standings(state)
    .slice(0, state.qualifiers)
    .map((row) => row.participantId);

  const unchanged =
    state.qualified.length === qualified.length &&
    state.qualified.every((id, index) => id === qualified[index]);
  if (unchanged) return state;

  return {
    ...state,
    qualified,
    ties: buildBracket(qualified),
    fixtures: leagueFixtures(state),
  };
}

function advanceBracket(state: TournamentState): TournamentState {
  const ties = state.ties.map((tie) => ({ ...tie }));
  const byId = new Map(ties.map((tie) => [tie.id, tie]));
  let fixtures = [...state.fixtures];
  const rounds = Math.max(...ties.map((tie) => tie.round));

  for (let round = 1; round <= rounds; round++) {
    for (const tie of ties.filter((item) => item.round === round)) {
      // A tie with both teams known needs its leg fixtures.
      if (
        tie.homeId &&
        tie.awayId &&
        !fixtures.some((f) => f.tieId === tie.id)
      ) {
        fixtures.push({
          id: `${tie.id}-l1`,
          phase: 'knockout',
          round,
          tieId: tie.id,
          leg: 1,
          homeId: tie.homeId,
          awayId: tie.awayId,
          homeGoals: null,
          awayGoals: null,
        });
        if (roundLegs(state, round) === 'double') {
          fixtures.push({
            id: `${tie.id}-l2`,
            phase: 'knockout',
            round,
            tieId: tie.id,
            leg: 2,
            homeId: tie.awayId,
            awayId: tie.homeId,
            homeGoals: null,
            awayGoals: null,
          });
        }
      }

      const winner = tieWinner({ ...state, ties, fixtures }, tie);
      const next = byId.get(`k${round + 1}-${Math.floor(tie.slot / 2)}`);
      if (!next) continue;

      const slotKey = tie.slot % 2 === 0 ? 'homeId' : 'awayId';
      if (next[slotKey] !== (winner ?? null)) {
        // The result changed — drop fixtures that depended on the old winner.
        if (next[slotKey] !== null) {
          fixtures = fixtures.filter(
            (fixture) => !dependsOn(ties, fixture.tieId, next.id),
          );
          clearFrom(ties, byId, next.id);
        }
        next[slotKey] = winner ?? null;
      }
    }
  }

  return { ...state, ties, fixtures };
}

function dependsOn(
  ties: KnockoutTie[],
  tieId: string,
  rootId: string,
): boolean {
  if (tieId === rootId) return true;
  const tie = ties.find((item) => item.id === tieId);
  const root = ties.find((item) => item.id === rootId);
  if (!tie || !root) return false;
  // Later rounds always descend from earlier ones in this bracket layout.
  return (
    tie.round > root.round &&
    Math.floor(tie.slot / 2 ** (tie.round - root.round)) === root.slot
  );
}

function clearFrom(
  ties: KnockoutTie[],
  byId: Map<string, KnockoutTie>,
  rootId: string,
): void {
  for (const tie of ties) {
    if (tie.id !== rootId && dependsOn(ties, tie.id, rootId)) {
      tie.homeId = null;
      tie.awayId = null;
      byId.set(tie.id, tie);
    }
  }
}

export function setScore(
  state: TournamentState,
  fixtureId: string,
  homeGoals: number | null,
  awayGoals: number | null,
): TournamentState {
  const fixtures = state.fixtures.map((fixture) =>
    fixture.id === fixtureId ? { ...fixture, homeGoals, awayGoals } : fixture,
  );
  return advance({ ...state, fixtures });
}

export function setShootoutWinner(
  state: TournamentState,
  tieId: string,
  participantId: string | null,
): TournamentState {
  const shootoutWinners = { ...state.shootoutWinners };
  if (participantId === null) {
    delete shootoutWinners[tieId];
  } else {
    shootoutWinners[tieId] = participantId;
  }
  return advance({ ...state, shootoutWinners });
}

/** League table: 3 points for a win, sorted by points, goal difference, goals. */
export function standings(state: TournamentState): StandingsRow[] {
  const rows = new Map<string, StandingsRow>(
    state.order.map((participantId) => [
      participantId,
      {
        participantId,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
      },
    ]),
  );

  for (const fixture of leagueFixtures(state)) {
    if (fixture.homeGoals === null || fixture.awayGoals === null) continue;
    const home = rows.get(fixture.homeId);
    const away = rows.get(fixture.awayId);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.goalsFor += fixture.homeGoals;
    home.goalsAgainst += fixture.awayGoals;
    away.goalsFor += fixture.awayGoals;
    away.goalsAgainst += fixture.homeGoals;

    if (fixture.homeGoals > fixture.awayGoals) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (fixture.homeGoals < fixture.awayGoals) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
  }

  for (const row of rows.values()) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
  }

  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      state.order.indexOf(a.participantId) -
        state.order.indexOf(b.participantId),
  );
}

export function isTournamentComplete(state: TournamentState): boolean {
  if (state.format === 'league') {
    return leaguePhaseComplete(state);
  }
  return champion(state) !== undefined;
}

export function champion(state: TournamentState): string | undefined {
  if (state.format === 'league') {
    if (!isTournamentComplete(state)) return undefined;
    return standings(state)[0]?.participantId;
  }
  const final = state.ties.find((tie) => tie.round === knockoutRounds(state));
  return final ? tieWinner(state, final) : undefined;
}
