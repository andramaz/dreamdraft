import { describe, expect, it } from 'vitest';
import type { Participant } from './draft-engine.js';
import { createRng } from './rng.js';
import {
  champion,
  createTournament,
  currentPhase,
  isTournamentComplete,
  knockoutFixtures,
  knockoutRounds,
  leagueFixtures,
  qualifierCount,
  roundLegs,
  setScore,
  setShootoutWinner,
  standings,
  tieWinner,
  type TournamentState,
} from './tournament.js';

function makeParticipants(count: number): Participant[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Player ${index + 1}`,
  }));
}

function make(
  count: number,
  format: 'league' | 'knockout' | 'ucl',
  legs: 'single' | 'double' = 'single',
  leagueLegs: 'single' | 'double' = 'single',
): TournamentState {
  const participants = makeParticipants(count);
  return createTournament({
    participants,
    order: participants.map((p) => p.id),
    format,
    legs,
    leagueLegs,
    rng: createRng(42),
  });
}

/** Plays every open fixture of the current phase, `winner` taking the tie. */
function playAll(
  state: TournamentState,
  score: (homeId: string, awayId: string) => [number, number],
): TournamentState {
  let next = state;
  for (const fixture of next.fixtures) {
    if (fixture.homeGoals !== null) continue;
    const [home, away] = score(fixture.homeId, fixture.awayId);
    next = setScore(next, fixture.id, home, away);
  }
  return next;
}

/** Lower participant number always wins, so results are predictable. */
const seedWins = (homeId: string, awayId: string): [number, number] =>
  homeId < awayId ? [2, 0] : [0, 2];

describe('league', () => {
  it('gives every pair exactly one game', () => {
    const state = make(4, 'league');
    expect(leagueFixtures(state)).toHaveLength(6);
    expect(new Set(state.fixtures.map((f) => f.round)).size).toBe(3);
  });

  it('handles an odd team count with byes', () => {
    const state = make(5, 'league');
    // 5 teams -> 5 rounds of 2 games, one team rests each round.
    expect(state.fixtures).toHaveLength(10);
    expect(new Set(state.fixtures.map((f) => f.round)).size).toBe(5);
  });

  it('awards 3 points for a win and 1 for a draw', () => {
    let state = make(4, 'league');
    const first = state.fixtures[0]!;
    state = setScore(state, first.id, 3, 1);
    const second = state.fixtures[1]!;
    state = setScore(state, second.id, 2, 2);

    const rows = new Map(
      standings(state).map((row) => [row.participantId, row]),
    );
    expect(rows.get(first.homeId)!.points).toBe(3);
    expect(rows.get(first.awayId)!.points).toBe(0);
    expect(rows.get(second.homeId)!.points).toBe(1);
    expect(rows.get(first.homeId)!.goalDiff).toBe(2);
  });

  it('crowns the table leader once every game is played', () => {
    const state = playAll(make(4, 'league'), seedWins);
    expect(isTournamentComplete(state)).toBe(true);
    expect(champion(state)).toBe('p1');
  });

  describe('home and away', () => {
    it('plays the round robin twice', () => {
      const single = make(4, 'league');
      const double = make(4, 'league', 'single', 'double');
      expect(leagueFixtures(double)).toHaveLength(
        leagueFixtures(single).length * 2,
      );
      expect(new Set(double.fixtures.map((f) => f.round)).size).toBe(6);
    });

    it('reverses the second half, so every pair meets home and away', () => {
      const state = make(4, 'league', 'single', 'double');
      const pairs = new Map<string, string[]>();
      for (const fixture of leagueFixtures(state)) {
        const key = [fixture.homeId, fixture.awayId].sort().join('-');
        pairs.set(key, [...(pairs.get(key) ?? []), fixture.homeId]);
      }
      expect(pairs.size).toBe(6);
      for (const [pair, hosts] of pairs) {
        expect(hosts, pair).toHaveLength(2);
        expect(new Set(hosts).size, pair).toBe(2);
      }
    });

    it('gives every fixture its own id', () => {
      const ids = make(5, 'league', 'single', 'double').fixtures.map(
        (fixture) => fixture.id,
      );
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('counts both games in the table', () => {
      const state = playAll(make(4, 'league', 'single', 'double'), seedWins);
      const rows = standings(state);
      expect(rows.every((row) => row.played === 6)).toBe(true);
      expect(champion(state)).toBe('p1');
    });

    it('leaves a ucl league phase single, whatever is asked for', () => {
      const state = make(4, 'ucl', 'single', 'double');
      expect(leagueFixtures(state)).toHaveLength(6);
    });
  });
});

describe('knockout', () => {
  it('builds a full bracket and advances winners', () => {
    let state = make(4, 'knockout');
    expect(state.ties).toHaveLength(3); // 2 semis + final
    expect(knockoutFixtures(state)).toHaveLength(2);

    state = playAll(state, seedWins);
    expect(knockoutFixtures(state)).toHaveLength(3); // the final appeared
    state = playAll(state, seedWins);
    expect(champion(state)).toBe('p1');
  });

  it('gives byes to the top seeds when the count is not a power of two', () => {
    const state = make(6, 'knockout');
    const firstRound = state.ties.filter((tie) => tie.round === 1);
    const byes = firstRound.filter((tie) => tie.homeId && !tie.awayId);
    expect(byes).toHaveLength(2);
    for (const tie of byes) {
      expect(tieWinner(state, tie)).toBe(tie.homeId);
    }
  });

  it('does not crown anyone while half the bracket is still byes', () => {
    // 9 of 16 slots taken: 7 first-round byes walk a team up one side of the
    // bracket, which must not read as "the final is won".
    const state = make(9, 'knockout');
    expect(champion(state)).toBeUndefined();
    expect(isTournamentComplete(state)).toBe(false);
    const finalTie = state.ties.find((tie) => tie.round === 4)!;
    expect(tieWinner(state, finalTie)).toBeUndefined();
    expect(knockoutFixtures(state).length).toBeGreaterThan(0);
  });

  it('adds up both legs of a two-legged tie', () => {
    let state = make(2, 'knockout', 'double');
    const [first, second] = knockoutFixtures(state);
    expect(second!.homeId).toBe(first!.awayId); // the tie is reversed

    // 0-1 away, then 1-1 back home: 2-1 on aggregate to the away side.
    state = setScore(state, first!.id, 0, 1);
    expect(champion(state)).toBeUndefined();
    state = setScore(state, second!.id, 1, 1);
    expect(champion(state)).toBe(first!.awayId);
  });

  it('needs a shootout winner when the aggregate is level', () => {
    let state = make(2, 'knockout');
    const final = state.fixtures[0]!;
    state = setScore(state, final.id, 1, 1);
    expect(champion(state)).toBeUndefined();

    state = setShootoutWinner(state, final.tieId, final.awayId);
    expect(champion(state)).toBe(final.awayId);
  });

  it('rolls back later rounds when an earlier score is corrected', () => {
    let state = playAll(make(4, 'knockout'), seedWins);
    const semi = state.ties.find((tie) => tie.round === 1)!;
    state = playAll(state, seedWins);
    expect(champion(state)).toBe('p1');

    // Flip the first semi: the final must forget its old participant.
    const leg = state.fixtures.find((f) => f.tieId === semi.id)!;
    state = setScore(state, leg.id, 0, 5);
    expect(champion(state)).toBeUndefined();
    expect(tieWinner(state, semi)).toBe(semi.awayId);
  });
});

describe('ucl', () => {
  it('fills the bracket with the largest power of two below the count', () => {
    expect(qualifierCount(3)).toBe(2);
    expect(qualifierCount(4)).toBe(2);
    expect(qualifierCount(6)).toBe(4);
    expect(qualifierCount(8)).toBe(4);
    expect(qualifierCount(10)).toBe(8);
    expect(qualifierCount(16)).toBe(8);
    // Always sends at least one team home, never leaves a bye.
    for (let teams = 2; teams <= 32; teams++) {
      const qualifiers = qualifierCount(teams);
      expect(qualifiers).toBeLessThan(Math.max(teams, 3));
      expect(Number.isInteger(Math.log2(qualifiers))).toBe(true);
    }
  });

  it('starts as a league and opens the bracket when the table is final', () => {
    let state = make(8, 'ucl');
    expect(currentPhase(state)).toBe('league');
    expect(state.ties).toHaveLength(0);
    expect(state.qualifiers).toBe(4);

    state = playAll(state, seedWins);
    expect(currentPhase(state)).toBe('knockout');
    expect(state.qualified).toEqual(['p1', 'p2', 'p3', 'p4']);
    // Seeded by the table: 1 v 4 and 2 v 3.
    const semis = state.ties.filter((tie) => tie.round === 1);
    expect(semis.map((tie) => [tie.homeId, tie.awayId])).toEqual([
      ['p1', 'p4'],
      ['p2', 'p3'],
    ]);
  });

  it('keeps league games out of the bracket and vice versa', () => {
    const state = playAll(make(8, 'ucl'), seedWins);
    expect(leagueFixtures(state)).toHaveLength(28);
    // Two semis over two legs each.
    expect(knockoutFixtures(state)).toHaveLength(4);
    // The table only counts the league phase.
    expect(standings(state)[0]!.played).toBe(7);
  });

  it('reseeds the bracket while no knockout game has been played', () => {
    let state = playAll(make(8, 'ucl'), seedWins);
    expect(state.qualified[0]).toBe('p1');
    const decider = leagueFixtures(state).find(
      (f) => f.homeId === 'p1' && f.awayId === 'p8',
    )!;

    // Clearing a score drops the bracket and hands the league phase back.
    state = setScore(state, decider.id, null, null);
    expect(currentPhase(state)).toBe('league');
    expect(state.ties).toHaveLength(0);

    // A heavy defeat costs p1 the top seeding, so the bracket is rebuilt.
    state = setScore(state, decider.id, 0, 9);
    expect(state.qualified[0]).toBe('p2');
    expect(state.ties.find((tie) => tie.round === 1)!.homeId).toBe('p2');
  });

  it('freezes the bracket once a knockout result is in', () => {
    let state = playAll(make(8, 'ucl'), seedWins);
    const before = state.qualified;
    const semi = knockoutFixtures(state)[0]!;
    state = setScore(state, semi.id, 3, 0);

    const league = leagueFixtures(state)[0]!;
    state = setScore(state, league.id, 9, 0);
    expect(state.qualified).toEqual(before);
    expect(state.ties.length).toBeGreaterThan(0);
  });

  it('plays the knockout rounds over two legs and the final over one', () => {
    let state = playAll(make(16, 'ucl'), seedWins);
    expect(state.qualifiers).toBe(8);
    expect(knockoutRounds(state)).toBe(3);

    // Quarters: two legs, reversed.
    const quarter = state.ties.find((tie) => tie.round === 1)!;
    const quarterLegs = state.fixtures.filter((f) => f.tieId === quarter.id);
    expect(quarterLegs).toHaveLength(2);
    expect(quarterLegs[1]!.homeId).toBe(quarterLegs[0]!.awayId);
    expect(roundLegs(state, 1)).toBe('double');
    expect(roundLegs(state, 2)).toBe('double');

    // Play through to the final, which gets a single game.
    state = playAll(state, seedWins); // quarters
    state = playAll(state, seedWins); // semis
    const final = state.ties.find((tie) => tie.round === 3)!;
    expect(roundLegs(state, 3)).toBe('single');
    expect(state.fixtures.filter((f) => f.tieId === final.id)).toHaveLength(1);

    state = playAll(state, seedWins);
    expect(champion(state)).toBe('p1');
  });

  it('gives a three-team ucl a single-game final and nothing else', () => {
    // Two qualifiers means the only knockout round *is* the final.
    let state = playAll(make(3, 'ucl'), seedWins);
    expect(state.qualifiers).toBe(2);
    expect(knockoutRounds(state)).toBe(1);
    expect(roundLegs(state, 1)).toBe('single');
    expect(knockoutFixtures(state)).toHaveLength(1);

    state = playAll(state, seedWins);
    expect(champion(state)).toBe('p1');
  });

  it('leaves the plain knockout format alone', () => {
    // `double` there still means every round, final included.
    const state = playAll(make(4, 'knockout', 'double'), seedWins);
    expect(roundLegs(state, knockoutRounds(state))).toBe('double');
    const final = state.ties.find((tie) => tie.round === 2)!;
    expect(state.fixtures.filter((f) => f.tieId === final.id)).toHaveLength(2);
  });

  it('crowns the bracket winner, not the league leader', () => {
    let state = playAll(make(8, 'ucl'), seedWins);
    expect(champion(state)).toBeUndefined(); // the league leader has won nothing

    // The lower seed wins every knockout game.
    const upset = (homeId: string, awayId: string): [number, number] =>
      homeId > awayId ? [1, 0] : [0, 1];
    state = playAll(state, upset);
    state = playAll(state, upset);
    expect(isTournamentComplete(state)).toBe(true);
    expect(champion(state)).toBe('p4');
  });
});
