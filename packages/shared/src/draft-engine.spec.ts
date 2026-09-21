import { describe, expect, it } from 'vitest';
import type { DraftConfig, DraftStyle } from './draft-config.js';
import {
  autoPick,
  availablePlayers,
  buildSequence,
  currentParticipantId,
  DraftSetupError,
  FORMATION_NAMES,
  fillShape,
  formationPositions,
  initDraft,
  isClubExhausted,
  isComplete,
  isRerollFree,
  pick,
  rerollsLeft,
  rollClub,
  rollableClubs,
  shapeFor,
  squads,
  TACTICS,
  yourChoiceLimit,
  type Participant,
} from './draft-engine.js';
import type { Player } from './player.js';
import { POSITIONS } from './positions.js';
import { createRng } from './rng.js';

const CLUBS = ['Club A', 'Club B', 'Club C', 'Club D'];

/** 4 clubs x 12 players, positions cycled so every position exists. */
function makePlayers(): Player[] {
  const players: Player[] = [];
  let id = 1;
  for (const club of CLUBS) {
    for (let i = 0; i < 12; i++) {
      players.push({
        id: id++,
        name: `${club} Player ${i + 1}`,
        position: POSITIONS[i % POSITIONS.length]!,
        rating: 70 + ((id * 7) % 20),
        club,
        gameVersion: 'FC26',
        pace: 70,
        shooting: 70,
        passing: 70,
        dribbling: 70,
        defending: 70,
        physical: 70,
        photoUrl: null,
      });
    }
  }
  return players;
}

const PARTICIPANTS: Participant[] = [
  { id: 'p1', name: 'Ali' },
  { id: 'p2', name: 'Berk' },
  { id: 'p3', name: 'Cem' },
];

function randomTeamsConfig(
  rules: Partial<DraftConfig['randomTeams']> = {},
  playersPerTeam = 4,
): DraftConfig {
  return {
    ...makeConfig('randomTeams', playersPerTeam),
    randomTeams: {
      rerolls: 3,
      allowRepeatTeams: true,
      maxPlayersPerTeam: 4,
      ...rules,
    },
  };
}

function makeConfig(style: DraftStyle, playersPerTeam = 4): DraftConfig {
  return {
    gameVersion: 'FC26',
    mode: 'match',
    draftOrder: { randomize: true, pickPattern: 'snake' },
    draftStyle: style,
    playersPerTeam,
  };
}

describe('buildSequence', () => {
  it('repeats the order every round when straight', () => {
    expect(buildSequence(['a', 'b', 'c'], 2, 'straight')).toEqual([
      'a',
      'b',
      'c',
      'a',
      'b',
      'c',
    ]);
  });

  it('reverses every other round when snake', () => {
    expect(buildSequence(['a', 'b', 'c'], 3, 'snake')).toEqual([
      'a',
      'b',
      'c',
      'c',
      'b',
      'a',
      'a',
      'b',
      'c',
    ]);
  });
});

describe('initDraft', () => {
  it('draws an order containing every participant exactly once', () => {
    const state = initDraft({
      config: makeConfig('yourChoice'),
      participants: PARTICIPANTS,
      players: makePlayers(),
      seed: 42,
    });
    expect([...state.order].sort()).toEqual(['p1', 'p2', 'p3']);
    expect(state.sequence).toHaveLength(3 * 4);
  });

  it('is reproducible from a seed', () => {
    const players = makePlayers();
    const args = {
      config: makeConfig('randomTeams'),
      participants: PARTICIPANTS,
      players,
      seed: 7,
    };
    expect(initDraft(args).order).toEqual(initDraft(args).order);
    const rolled = () =>
      rollClub(initDraft(args), players, createRng(7)).randomTeams.club;
    expect(rolled()).toEqual(rolled());
  });

  it('rejects a pool that is too small', () => {
    expect(() =>
      initDraft({
        config: makeConfig('yourChoice', 18),
        participants: PARTICIPANTS,
        players: makePlayers().slice(0, 20),
        seed: 1,
      }),
    ).toThrow(DraftSetupError);
  });

  it('gives every participant their reroll rights in randomTeams', () => {
    const state = initDraft({
      config: randomTeamsConfig({ rerolls: 4 }),
      participants: PARTICIPANTS,
      players: makePlayers(),
      seed: 3,
    });
    expect(state.randomTeams.rerollsLeft).toEqual({ p1: 4, p2: 4, p3: 4 });
    expect(state.randomTeams.club).toBeNull();
  });

  it('refuses randomTeams when there are fewer clubs than needed', () => {
    // 4 clubs in the pool, 5 players per team, no repeats -> 5 clubs needed.
    expect(() =>
      initDraft({
        config: randomTeamsConfig({ allowRepeatTeams: false }, 5),
        participants: PARTICIPANTS,
        players: makePlayers(),
        seed: 1,
      }),
    ).toThrow(DraftSetupError);
  });
});

describe('randomTeams rolling', () => {
  const players = makePlayers();

  it('offers nothing until a club is rolled', () => {
    const state = initDraft({
      config: randomTeamsConfig(),
      participants: PARTICIPANTS,
      players,
      seed: 8,
    });
    expect(availablePlayers(state, players)).toHaveLength(0);

    const rolled = rollClub(state, players, createRng(1));
    expect(rolled.randomTeams.club).not.toBeNull();
    expect(
      availablePlayers(rolled, players).every(
        (p) => p.club === rolled.randomTeams.club,
      ),
    ).toBe(true);
  });

  it('spends a reroll right and lands on a different club', () => {
    const state = rollClub(
      initDraft({
        config: randomTeamsConfig({ rerolls: 3 }),
        participants: PARTICIPANTS,
        players,
        seed: 8,
      }),
      players,
      createRng(2),
    );
    const next = rollClub(state, players, createRng(3), { reroll: true });
    expect(rerollsLeft(next)).toBe(2);
    expect(next.randomTeams.club).not.toBe(state.randomTeams.club);
  });

  it('never rolls a club the picker already used when repeats are off', () => {
    let state = rollClub(
      initDraft({
        config: randomTeamsConfig({ allowRepeatTeams: false }),
        participants: PARTICIPANTS,
        players,
        seed: 12,
      }),
      players,
      createRng(4),
    );
    const picker = currentParticipantId(state)!;
    const usedClub = state.randomTeams.club!;
    const target = availablePlayers(state, players)[0]!;
    state = pick(state, target.id, players);

    // Walk back round to the same picker.
    const rng = createRng(5);
    while (currentParticipantId(state) !== picker && !isComplete(state)) {
      state = autoPick(state, players, rng);
    }
    expect(rollableClubs(state, players)).not.toContain(usedClub);
  });

  it('flags an exhausted club instead of offering players', () => {
    const config = randomTeamsConfig({
      allowRepeatTeams: true,
      maxPlayersPerTeam: 1,
    });
    let state = rollClub(
      initDraft({ config, participants: PARTICIPANTS, players, seed: 15 }),
      players,
      createRng(6),
    );
    const picker = currentParticipantId(state)!;
    const club = state.randomTeams.club!;
    state = pick(state, availablePlayers(state, players)[0]!.id, players);

    // Force the same club back onto the board for the same picker.
    const rng = createRng(7);
    while (currentParticipantId(state) !== picker) {
      state = autoPick(state, players, rng);
    }
    state = { ...state, randomTeams: { ...state.randomTeams, club } };
    expect(isClubExhausted(state, players)).toBe(true);
    expect(availablePlayers(state, players)).toHaveLength(0);
  });

  it('does not spend a right when the club on the board is unusable', () => {
    const config = randomTeamsConfig({
      allowRepeatTeams: true,
      maxPlayersPerTeam: 1,
    });
    let state = rollClub(
      initDraft({ config, participants: PARTICIPANTS, players, seed: 31 }),
      players,
      createRng(21),
    );
    const picker = currentParticipantId(state)!;
    const club = state.randomTeams.club!;
    state = pick(state, availablePlayers(state, players)[0]!.id, players);

    const rng = createRng(22);
    while (currentParticipantId(state) !== picker) {
      state = autoPick(state, players, rng);
    }
    // Hand them back the club they have already filled their quota from.
    state = { ...state, randomTeams: { ...state.randomTeams, club } };
    expect(isRerollFree(state, players)).toBe(true);

    const before = rerollsLeft(state);
    const after = rollClub(state, players, createRng(23), { reroll: true });
    expect(rerollsLeft(after)).toBe(before);
    expect(isRerollFree(after, players)).toBe(false);
  });

  it('still spends a right when swapping a club that could be used', () => {
    const state = rollClub(
      initDraft({
        config: randomTeamsConfig({ rerolls: 3 }),
        participants: PARTICIPANTS,
        players,
        seed: 33,
      }),
      players,
      createRng(24),
    );
    expect(isRerollFree(state, players)).toBe(false);
    expect(
      rerollsLeft(rollClub(state, players, createRng(25), { reroll: true })),
    ).toBe(2);
  });
});

describe('picking', () => {
  it('only offers players from the rolled club (randomTeams)', () => {
    const players = makePlayers();
    const state = rollClub(
      initDraft({
        config: randomTeamsConfig(),
        participants: PARTICIPANTS,
        players,
        seed: 11,
      }),
      players,
      createRng(11),
    );
    const club = state.randomTeams.club;
    expect(availablePlayers(state, players).every((p) => p.club === club)).toBe(
      true,
    );
  });

  it('only offers players matching the rolled constraint (randomPosition)', () => {
    const players = makePlayers();
    const state = initDraft({
      config: makeConfig('randomPosition'),
      participants: PARTICIPANTS,
      players,
      seed: 5,
    });
    const constraint = state.constraint!;
    expect(constraint.position).toBeDefined();
    expect(
      availablePlayers(state, players).every(
        (p) =>
          p.position === constraint.position &&
          p.rating >= constraint.minRating! &&
          p.rating <= constraint.maxRating!,
      ),
    ).toBe(true);
  });

  it('keeps squads disjoint in gambler', () => {
    const players = makePlayers();
    const state = initDraft({
      config: makeConfig('gambler'),
      participants: PARTICIPANTS,
      players,
      seed: 9,
    });
    const all = Object.values(state.assignedSquads).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('rejects a player that is not on offer', () => {
    const players = makePlayers();
    const state = rollClub(
      initDraft({
        config: randomTeamsConfig(),
        participants: PARTICIPANTS,
        players,
        seed: 2,
      }),
      players,
      createRng(2),
    );
    const otherClubPlayer = players.find(
      (p) => p.club !== state.randomTeams.club,
    )!;
    expect(() => pick(state, otherClubPlayer.id, players)).toThrow(
      DraftSetupError,
    );
  });

  it('does not mutate the previous state', () => {
    const players = makePlayers();
    const state = initDraft({
      config: makeConfig('yourChoice'),
      participants: PARTICIPANTS,
      players,
      seed: 4,
    });
    const next = pick(state, availablePlayers(state, players)[0]!.id, players);
    expect(state.picks).toHaveLength(0);
    expect(next.picks).toHaveLength(1);
  });
});

describe('gambler', () => {
  /** Enough of every position that a shape is always fillable. */
  function deepPool(): Player[] {
    const players: Player[] = [];
    let id = 1;
    for (const club of CLUBS) {
      for (const position of POSITIONS) {
        for (let i = 0; i < 4; i++) {
          players.push({
            id: id++,
            name: `${club} ${position} ${i + 1}`,
            position,
            rating: 70 + (id % 20),
            club,
            gameVersion: 'FC26',
            pace: 70,
            shooting: 70,
            passing: 70,
            dribbling: 70,
            defending: 70,
            physical: 70,
            photoUrl: null,
          });
        }
      }
    }
    return players;
  }

  function deal(playersPerTeam: number, seed = 11) {
    const players = deepPool();
    const state = initDraft({
      config: makeConfig('gambler', playersPerTeam),
      participants: PARTICIPANTS,
      players,
      seed,
    });
    return { state, players };
  }

  it('hands everyone a finished squad, no picking left', () => {
    const { state } = deal(11);
    for (const participant of PARTICIPANTS) {
      expect(state.assignedSquads[participant.id]).toHaveLength(11);
    }
  });

  it('fills one of the known formations slot for slot', () => {
    const { state, players } = deal(11);
    const byId = new Map(players.map((player) => [player.id, player]));

    for (const participant of PARTICIPANTS) {
      const squad = state.assignedSquads[participant.id]!.map(
        (id) => byId.get(id)!.position,
      );
      const shape = [...squad].sort().join(',');
      const matches = FORMATION_NAMES.some(
        (name) => formationPositions(name).sort().join(',') === shape,
      );
      expect(matches, `${participant.id} had ${shape}`).toBe(true);
    }
  });

  it('always includes a keeper and never more than one', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { state, players } = deal(11, seed);
      const byId = new Map(players.map((player) => [player.id, player]));
      for (const participant of PARTICIPANTS) {
        const keepers = state.assignedSquads[participant.id]!.map(
          (id) => byId.get(id)!.position,
        ).filter((position) => position === 'GK');
        expect(keepers).toHaveLength(1);
      }
    }
  });

  it('adds the rest as substitutes once the eleven is set', () => {
    const { state, players } = deal(16);
    const byId = new Map(players.map((player) => [player.id, player]));

    for (const participant of PARTICIPANTS) {
      const squad = state.assignedSquads[participant.id]!;
      expect(squad).toHaveLength(16);
      // The first eleven still form a shape; the five after it are a free draw.
      const eleven = squad.slice(0, 11).map((id) => byId.get(id)!.position);
      const shape = [...eleven].sort().join(',');
      expect(
        FORMATION_NAMES.some(
          (name) => formationPositions(name).sort().join(',') === shape,
        ),
      ).toBe(true);
    }
  });

  it('keeps the eleven at the front once the squads are played out', () => {
    const players = deepPool();
    const rng = createRng(4);
    let state = initDraft({
      config: makeConfig('gambler', 15),
      participants: PARTICIPANTS,
      players,
      seed: 4,
    });
    while (!isComplete(state)) {
      state = autoPick(state, players, rng);
    }

    // What the squad list shows must still read shape first, bench after.
    for (const participant of PARTICIPANTS) {
      const squad = squads(state, players)[participant.id]!;
      expect(squad).toHaveLength(15);
      const shape = squad
        .slice(0, 11)
        .map((player) => player.position)
        .sort()
        .join(',');
      expect(
        FORMATION_NAMES.some(
          (name) => formationPositions(name).sort().join(',') === shape,
        ),
        `${participant.id} opened with ${shape}`,
      ).toBe(true);
    }
  });

  it('never deals the same player to two participants', () => {
    const { state } = deal(18);
    const all = PARTICIPANTS.flatMap(
      (participant) => state.assignedSquads[participant.id]!,
    );
    expect(new Set(all).size).toBe(all.length);
  });

  it('falls back to a nearby role when a position runs out', () => {
    // One keeper for three participants: two squads have to improvise.
    const players = deepPool().filter(
      (player) => player.position !== 'GK' || player.id % 1000 === 0,
    );
    const keepers = players.filter((p) => p.position === 'GK').length;
    expect(keepers).toBeLessThan(PARTICIPANTS.length);

    const state = initDraft({
      config: makeConfig('gambler', 11),
      participants: PARTICIPANTS,
      players,
      seed: 3,
    });
    // Squads are still full — the shape bends rather than leaving a hole.
    for (const participant of PARTICIPANTS) {
      expect(state.assignedSquads[participant.id]).toHaveLength(11);
    }
  });
});

describe('fillShape', () => {
  const players = makePlayers();
  const of = (position: string) =>
    players.filter((player) => player.position === position);

  it('puts every slot in the hands of its own position', () => {
    const squad = formationPositions('4-4-2').map((position, index) => {
      const pool = of(position);
      return pool[index % pool.length]!;
    });
    const { slots, bench } = fillShape(squad, '4-4-2');
    expect(slots).toHaveLength(11);
    expect(slots.every((player) => player !== null)).toBe(true);
    slots.forEach((player, index) => {
      expect(player!.position).toBe(formationPositions('4-4-2')[index]);
    });
    expect(bench).toHaveLength(0);
  });

  it('leaves a slot empty when nothing fits, and benches the rest', () => {
    // Keepers only: one takes the gloves, the other ten slots stay empty.
    const keepers = of('GK').slice(0, 3);
    const { slots, bench } = fillShape(keepers, '4-3-3');
    expect(slots[0]!.position).toBe('GK');
    expect(slots.filter((player) => player !== null)).toHaveLength(1);
    expect(bench).toHaveLength(2);
  });

  it('falls back to a nearby role before leaving a hole', () => {
    // No left-back, but a spare right-back. The centre-back slots come first
    // in the shape and are covered by real centre-backs, so the spare full-back
    // is still around when the left-back slot is reached.
    const squad = [
      ...of('GK').slice(0, 1),
      ...of('CB').slice(0, 2),
      ...of('RB').slice(0, 2),
    ];
    const { slots } = fillShape(squad, '4-4-2');
    const leftBack = formationPositions('4-4-2').indexOf('LB');
    expect(slots[leftBack]?.position).toBe('RB');
  });

  it('honours a pinned player over the automatic choice', () => {
    const squad = [...of('ST').slice(0, 2), ...of('GK').slice(0, 1)];
    const striker = squad[1]!;
    // Put a striker in goal on purpose.
    const { slots } = fillShape(squad, '4-4-2', { 0: striker.id });
    expect(slots[0]!.id).toBe(striker.id);
    expect(slots[0]!.position).toBe('ST');
  });

  it('never places the same player twice', () => {
    const squad = players.slice(0, 14);
    const { slots, bench } = fillShape(squad, '3-5-2');
    const placed = slots.filter((p): p is Player => p !== null);
    const ids = [...placed, ...bench].map((player) => player.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(squad.length);
  });

  it('gives every shape eleven slots', () => {
    for (const name of FORMATION_NAMES) {
      expect(formationPositions(name)).toHaveLength(11);
      expect(formationPositions(name).filter((p) => p === 'GK')).toHaveLength(
        1,
      );
    }
  });
});

describe('shapeFor', () => {
  it('lays out eleven slots with one keeper in every style', () => {
    for (const name of FORMATION_NAMES) {
      for (const tactic of TACTICS) {
        const shape = shapeFor(name, tactic);
        expect(shape, `${name} ${tactic}`).toHaveLength(11);
        expect(
          shape.filter((slot) => slot.position === 'GK'),
          `${name} ${tactic}`,
        ).toHaveLength(1);
        for (const slot of shape) {
          expect(slot.x).toBeGreaterThanOrEqual(0);
          expect(slot.x).toBeLessThanOrEqual(100);
          expect(slot.y).toBeGreaterThanOrEqual(0);
          expect(slot.y).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it('changes the roles, not just the depth, between styles', () => {
    for (const name of FORMATION_NAMES) {
      const roles = TACTICS.map((tactic) =>
        shapeFor(name, tactic)
          .map((slot) => slot.position)
          .join(','),
      );
      expect(new Set(roles).size, name).toBe(3);
    }
  });

  it('never moves the keeper off his line', () => {
    for (const name of FORMATION_NAMES) {
      for (const tactic of TACTICS) {
        expect(shapeFor(name, tactic)[0]).toEqual({
          position: 'GK',
          x: 50,
          y: 92,
        });
      }
    }
  });

  it('pushes the outfield further forward the more attacking the style', () => {
    for (const name of FORMATION_NAMES) {
      const depth = TACTICS.map((tactic) => {
        const outfield = shapeFor(name, tactic).slice(1);
        return outfield.reduce((sum, slot) => sum + slot.y, 0) / 10;
      });
      const [defensive, balanced, attacking] = depth as [
        number,
        number,
        number,
      ];
      expect(defensive, name).toBeGreaterThan(balanced);
      expect(balanced, name).toBeGreaterThan(attacking);
    }
  });

  it('hands back a copy, so a caller cannot edit the table', () => {
    const shape = shapeFor('4-3-3', 'balanced');
    shape[0]!.y = 1;
    expect(shapeFor('4-3-3', 'balanced')[0]!.y).toBe(92);
  });
});

describe('yourChoice club limit', () => {
  function yourChoiceConfig(
    maxPlayersPerTeam: number,
    playersPerTeam = 4,
  ): DraftConfig {
    return {
      ...makeConfig('yourChoice', playersPerTeam),
      yourChoice: { maxPlayersPerTeam },
    };
  }

  function start(config: DraftConfig, players: Player[]) {
    return initDraft({
      config,
      participants: PARTICIPANTS,
      players,
      seed: 7,
    });
  }

  /** One pick from `club` for whoever is on the clock. */
  function takeFrom(
    state: ReturnType<typeof start>,
    club: string,
    players: Player[],
  ) {
    const target = availablePlayers(state, players).find(
      (player) => player.club === club,
    )!;
    return pick(state, target.id, players);
  }

  /** The pick order is drawn, so never assume who is first — walk to them. */
  function advanceTo(
    state: ReturnType<typeof start>,
    participantId: string,
    players: Player[],
  ) {
    let next = state;
    while (currentParticipantId(next) !== participantId) {
      next = pick(next, availablePlayers(next, players)[0]!.id, players);
    }
    return next;
  }

  it('treats a missing limit as no limit', () => {
    expect(yourChoiceLimit(makeConfig('yourChoice', 11))).toBe(11);
    expect(yourChoiceLimit(yourChoiceConfig(3, 11))).toBe(3);
  });

  it('drops a club from the board once the picker has filled it', () => {
    const players = makePlayers();
    let state = start(yourChoiceConfig(2), players);
    const club = CLUBS[0]!;
    const picker = currentParticipantId(state)!;
    expect(availablePlayers(state, players).some((p) => p.club === club)).toBe(
      true,
    );

    // Two from the same club is the whole quota; the third turn must be clean.
    state = takeFrom(state, club, players);
    state = advanceTo(state, picker, players);
    state = takeFrom(state, club, players);
    state = advanceTo(state, picker, players);

    expect(availablePlayers(state, players).some((p) => p.club === club)).toBe(
      false,
    );
  });

  it('refuses a pick from a club that is already full', () => {
    const players = makePlayers();
    let state = start(yourChoiceConfig(1), players);
    const club = CLUBS[0]!;
    const picker = currentParticipantId(state)!;

    state = takeFrom(state, club, players);
    state = advanceTo(state, picker, players);

    const blocked = players.find(
      (player) =>
        player.club === club &&
        !state.picks.some((p) => p.playerId === player.id),
    )!;
    expect(() => pick(state, blocked.id, players)).toThrow(DraftSetupError);
  });

  it('counts per participant, not across the draft', () => {
    const players = makePlayers();
    let state = start(yourChoiceConfig(1), players);
    const club = CLUBS[0]!;

    // The first picker uses up their single slot for this club.
    state = takeFrom(state, club, players);
    // Whoever is next is untouched by that.
    expect(availablePlayers(state, players).some((p) => p.club === club)).toBe(
      true,
    );
  });

  it('still fills every squad under a tight limit', () => {
    const players = makePlayers();
    const rng = createRng(5);
    let state = start(yourChoiceConfig(1), players);

    while (!isComplete(state)) {
      state = autoPick(state, players, rng);
    }

    // 4 players each, never twice from the same club.
    for (const participant of PARTICIPANTS) {
      const squad = squads(state, players)[participant.id]!;
      expect(squad).toHaveLength(4);
      expect(new Set(squad.map((p) => p.club)).size).toBe(4);
    }
  });
});

describe('a full draft', () => {
  const styles: DraftStyle[] = [
    'randomTeams',
    'yourChoice',
    'randomPosition',
    'gambler',
  ];

  it.each(styles)('completes with %s and fills every squad', (style) => {
    const players = makePlayers();
    const rng = createRng(123);
    let state = initDraft({
      config: makeConfig(style),
      participants: PARTICIPANTS,
      players,
      seed: 123,
    });

    while (!isComplete(state)) {
      state = autoPick(state, players, rng);
    }

    const result = squads(state, players);
    for (const participant of PARTICIPANTS) {
      expect(result[participant.id]).toHaveLength(4);
    }
    // No player ends up in two squads.
    const allIds = state.picks.map((p) => p.playerId);
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
