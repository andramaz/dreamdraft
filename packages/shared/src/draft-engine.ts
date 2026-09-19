import {
  REROLLS_MIN,
  type DraftConfig,
  type PickPattern,
  type RandomTeamsConfig,
} from './draft-config.js';
import type { Player } from './player.js';
import { POSITIONS, type Position } from './positions.js';
import { createRng, pickRandom, randomSeed, shuffle, type Rng } from './rng.js';

export interface Participant {
  id: string;
  name: string;
}

/** What the current picker is allowed to take (Random Position style). */
export interface PickConstraint {
  position?: Position;
  minRating?: number;
  maxRating?: number;
}

export interface DraftPick {
  /** 0-based index over the whole draft. */
  index: number;
  /** 1-based round. */
  round: number;
  participantId: string;
  playerId: number;
}

export interface DraftState {
  config: DraftConfig;
  participants: Participant[];
  /** Participant ids in drawn pick order (slot 1, 2, 3...). */
  order: string[];
  /** Participant id for every pick of the draft, in order. */
  sequence: string[];
  picks: DraftPick[];
  /** Index into `sequence`; equals sequence.length when the draft is done. */
  currentIndex: number;
  /** randomTeams: the rolled club and everyone's remaining reroll rights. */
  randomTeams: RandomTeamsState;
  /** gambler: participant id -> the finished squad they were dealt. */
  assignedSquads: Record<string, number[]>;
  /** randomPosition: constraint for the pick at `currentIndex`. */
  constraint?: PickConstraint;
  seed: number;
}

/**
 * Random Teams: a club is rolled for every single pick. The picker may burn a
 * "another team" right to roll again; they pick one player from the club shown.
 */
export interface RandomTeamsState {
  /** participant id -> rerolls left. */
  rerollsLeft: Record<string, number>;
  /** Club rolled for the current pick; null until the picker rolls. */
  club: string | null;
}

export class DraftSetupError extends Error {}

/**
 * Pick order for every round.
 * straight: 1-2-3, 1-2-3 … | snake: 1-2-3, 3-2-1, 1-2-3 …
 */
export function buildSequence(
  order: readonly string[],
  playersPerTeam: number,
  pattern: PickPattern,
): string[] {
  const sequence: string[] = [];
  for (let round = 0; round < playersPerTeam; round++) {
    const reversed = pattern === 'snake' && round % 2 === 1;
    sequence.push(...(reversed ? [...order].reverse() : order));
  }
  return sequence;
}

export function drawOrder(
  participants: readonly Participant[],
  rng: Rng,
): string[] {
  return shuffle(participants, rng).map((p) => p.id);
}

/** Clubs that have at least `minPlayers` players in the pool. */
export function eligibleClubs(
  players: readonly Player[],
  minPlayers = 1,
): string[] {
  const counts = new Map<string, number>();
  for (const player of players) {
    counts.set(player.club, (counts.get(player.club) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= minPlayers)
    .map(([club]) => club)
    .sort();
}

/** Random Teams rules with the defaults applied. */
export function randomTeamsRules(config: DraftConfig): RandomTeamsConfig {
  const rules = config.randomTeams;
  return {
    rerolls: rules?.rerolls ?? REROLLS_MIN,
    allowRepeatTeams: rules?.allowRepeatTeams ?? false,
    maxPlayersPerTeam: rules?.allowRepeatTeams
      ? Math.max(1, rules.maxPlayersPerTeam)
      : 1,
  };
}

/**
 * One slot of a starting eleven, with where it stands on the pitch.
 * `x` runs 0 (left touchline) to 100 (right), `y` runs 0 (the goal you attack)
 * to 100 (your own goal), so a keeper sits near y = 92.
 */
export interface FormationSlot {
  position: Position;
  x: number;
  y: number;
}

/**
 * The eleven slots on the pitch. Some positions repeat (two centre-backs) and
 * some sit out — that is what a real shape looks like, and it is why "one of
 * every position key" is not the rule here.
 */
export const FORMATIONS: Record<string, readonly FormationSlot[]> = {
  '4-3-3': [
    { position: 'GK', x: 50, y: 92 },
    { position: 'RB', x: 85, y: 71 },
    { position: 'CB', x: 63, y: 76 },
    { position: 'CB', x: 37, y: 76 },
    { position: 'LB', x: 15, y: 71 },
    { position: 'CDM', x: 50, y: 56 },
    { position: 'CM', x: 72, y: 45 },
    { position: 'CM', x: 28, y: 45 },
    { position: 'RW', x: 82, y: 22 },
    { position: 'ST', x: 50, y: 15 },
    { position: 'LW', x: 18, y: 22 },
  ],
  '4-4-2': [
    { position: 'GK', x: 50, y: 92 },
    { position: 'RB', x: 85, y: 71 },
    { position: 'CB', x: 63, y: 76 },
    { position: 'CB', x: 37, y: 76 },
    { position: 'LB', x: 15, y: 71 },
    { position: 'RM', x: 84, y: 48 },
    { position: 'CM', x: 62, y: 51 },
    { position: 'CM', x: 38, y: 51 },
    { position: 'LM', x: 16, y: 48 },
    { position: 'ST', x: 62, y: 18 },
    { position: 'ST', x: 38, y: 18 },
  ],
  '4-2-3-1': [
    { position: 'GK', x: 50, y: 92 },
    { position: 'RB', x: 85, y: 71 },
    { position: 'CB', x: 63, y: 76 },
    { position: 'CB', x: 37, y: 76 },
    { position: 'LB', x: 15, y: 71 },
    { position: 'CDM', x: 62, y: 57 },
    { position: 'CDM', x: 38, y: 57 },
    { position: 'RM', x: 82, y: 33 },
    { position: 'CAM', x: 50, y: 36 },
    { position: 'LM', x: 18, y: 33 },
    { position: 'ST', x: 50, y: 14 },
  ],
  '3-5-2': [
    { position: 'GK', x: 50, y: 92 },
    { position: 'CB', x: 72, y: 76 },
    { position: 'CB', x: 50, y: 78 },
    { position: 'CB', x: 28, y: 76 },
    { position: 'CDM', x: 50, y: 58 },
    { position: 'CM', x: 68, y: 47 },
    { position: 'CM', x: 32, y: 47 },
    { position: 'RM', x: 88, y: 42 },
    { position: 'LM', x: 12, y: 42 },
    { position: 'ST', x: 62, y: 18 },
    { position: 'ST', x: 38, y: 18 },
  ],
  '4-2-4': [
    { position: 'GK', x: 50, y: 92 },
    { position: 'RB', x: 85, y: 71 },
    { position: 'CB', x: 63, y: 76 },
    { position: 'CB', x: 37, y: 76 },
    { position: 'LB', x: 15, y: 71 },
    { position: 'CM', x: 64, y: 50 },
    { position: 'CM', x: 36, y: 50 },
    { position: 'RW', x: 84, y: 22 },
    { position: 'ST', x: 61, y: 15 },
    { position: 'ST', x: 39, y: 15 },
    { position: 'LW', x: 16, y: 22 },
  ],
  '5-3-2': [
    { position: 'GK', x: 50, y: 92 },
    { position: 'RB', x: 90, y: 68 },
    { position: 'CB', x: 68, y: 78 },
    { position: 'CB', x: 50, y: 80 },
    { position: 'CB', x: 32, y: 78 },
    { position: 'LB', x: 10, y: 68 },
    { position: 'CDM', x: 50, y: 55 },
    { position: 'CM', x: 70, y: 45 },
    { position: 'CM', x: 30, y: 45 },
    { position: 'ST', x: 62, y: 18 },
    { position: 'ST', x: 38, y: 18 },
  ],
  '4-5-1': [
    { position: 'GK', x: 50, y: 92 },
    { position: 'RB', x: 85, y: 71 },
    { position: 'CB', x: 63, y: 76 },
    { position: 'CB', x: 37, y: 76 },
    { position: 'LB', x: 15, y: 71 },
    { position: 'RM', x: 86, y: 45 },
    { position: 'CM', x: 66, y: 52 },
    { position: 'CM', x: 34, y: 52 },
    { position: 'CAM', x: 50, y: 36 },
    { position: 'LM', x: 14, y: 45 },
    { position: 'ST', x: 50, y: 14 },
  ],
  '3-4-3': [
    { position: 'GK', x: 50, y: 92 },
    { position: 'CB', x: 72, y: 76 },
    { position: 'CB', x: 50, y: 78 },
    { position: 'CB', x: 28, y: 76 },
    { position: 'RM', x: 86, y: 47 },
    { position: 'CM', x: 63, y: 51 },
    { position: 'CM', x: 37, y: 51 },
    { position: 'LM', x: 14, y: 47 },
    { position: 'RW', x: 80, y: 21 },
    { position: 'ST', x: 50, y: 15 },
    { position: 'LW', x: 20, y: 21 },
  ],
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);

/** The positions a shape asks for, in slot order. */
export function formationPositions(name: string): Position[] {
  return (FORMATIONS[name] ?? []).map((slot) => slot.position);
}

/**
 * How high up the pitch the outfield lines sit. Purely a layout shift — the
 * app has no tactics engine behind it, and nothing else reads this.
 */
export const TACTICS = ['defensive', 'balanced', 'attacking'] as const;
export type Tactic = (typeof TACTICS)[number];

const TACTIC_SHIFT: Record<Tactic, number> = {
  defensive: 7,
  balanced: 0,
  attacking: -7,
};

/** A shape's slots with the tactic applied. The keeper never moves. */
export function shapeFor(name: string, tactic: Tactic): FormationSlot[] {
  const shift = TACTIC_SHIFT[tactic];
  return (FORMATIONS[name] ?? []).map((slot, index) =>
    index === 0 ? { ...slot } : { ...slot, y: clampPercent(slot.y + shift) },
  );
}

function clampPercent(value: number): number {
  return Math.min(96, Math.max(8, value));
}

/**
 * Where to look when a position has run dry — nearest role first, so a missing
 * right-back becomes a left-back before it becomes a striker.
 */
const NEARBY: Record<Position, readonly Position[]> = {
  GK: [],
  RB: ['LB', 'CB', 'RM'],
  CB: ['RB', 'LB', 'CDM'],
  LB: ['RB', 'CB', 'LM'],
  CDM: ['CM', 'CB', 'CAM'],
  CM: ['CDM', 'CAM', 'RM'],
  CAM: ['CM', 'RM', 'LM'],
  RM: ['RW', 'CM', 'LM'],
  LM: ['LW', 'CM', 'RM'],
  RW: ['RM', 'LW', 'ST'],
  LW: ['LM', 'RW', 'ST'],
  ST: ['CAM', 'RW', 'LW'],
};

/**
 * Deals one Gambler squad: a random shape filled position by position, then
 * whatever is left over as substitutes. Takes the players it uses out of
 * `pool`, so dealing round the table never hands the same player out twice.
 */
export function dealSquad(pool: Player[], size: number, rng: Rng): Player[] {
  const take = (player: Player) => {
    pool.splice(pool.indexOf(player), 1);
    return player;
  };
  const firstOf = (position: Position) =>
    pool.find((player) => player.position === position);

  const formation = formationPositions(pickRandom(FORMATION_NAMES, rng));
  const squad: Player[] = [];

  for (const slot of formation.slice(0, size)) {
    let player = firstOf(slot);
    for (const fallback of NEARBY[slot]) {
      if (player) break;
      player = firstOf(fallback);
    }
    // Still nothing: the shape cannot be honoured, so take whoever is left.
    player ??= pool[0];
    if (player) squad.push(take(player));
  }

  // Anything past the eleven is a bench place, and those are a pure draw.
  while (squad.length < size && pool.length > 0) {
    squad.push(take(pickRandom(pool, rng)));
  }

  return squad;
}

/**
 * Which shape a dealt eleven turned out to be. Undefined when a position ran
 * out and the fallback bent it out of any known formation.
 */
export function formationOf(squad: readonly Player[]): string | undefined {
  const shape = squad
    .slice(0, 11)
    .map((player) => player.position)
    .sort()
    .join(',');
  return FORMATION_NAMES.find(
    (name) => formationPositions(name).sort().join(',') === shape,
  );
}

/**
 * Lays a squad out in a shape: each slot takes the best-rated player of its own
 * position, then the nearest role, and is left empty if nothing fits. Whatever
 * is not placed becomes the bench.
 *
 * `pinned` maps a slot index to a player the user put there by hand; those are
 * honoured first and never moved by the auto-fill.
 */
export function fillShape(
  squad: readonly Player[],
  formation: string,
  pinned: Readonly<Record<number, number>> = {},
): { slots: (Player | null)[]; bench: Player[] } {
  const positions = formationPositions(formation);
  const byId = new Map(squad.map((player) => [player.id, player]));
  const slots: (Player | null)[] = positions.map(() => null);
  const used = new Set<number>();

  for (const [index, playerId] of Object.entries(pinned)) {
    const slot = Number(index);
    const player = byId.get(playerId);
    if (player && slot < slots.length) {
      slots[slot] = player;
      used.add(player.id);
    }
  }

  const free = () =>
    [...squad]
      .filter((player) => !used.has(player.id))
      .sort((a, b) => b.rating - a.rating);

  const claim = (position: Position) => {
    const exact = free().find((player) => player.position === position);
    if (exact) return exact;
    for (const nearby of NEARBY[position]) {
      const close = free().find((player) => player.position === nearby);
      if (close) return close;
    }
    return undefined;
  };

  positions.forEach((position, index) => {
    if (slots[index]) return;
    const player = claim(position);
    if (player) {
      slots[index] = player;
      used.add(player.id);
    }
  });

  return { slots, bench: free() };
}

/**
 * Your Choice club limit. Absent means none, which is the same as allowing a
 * whole squad from one club.
 */
export function yourChoiceLimit(config: DraftConfig): number {
  return config.yourChoice?.maxPlayersPerTeam ?? config.playersPerTeam;
}

/** Club -> how many players a participant already took from it. */
export function clubCounts(
  state: DraftState,
  participantId: string,
  players: readonly Player[],
): Map<string, number> {
  const byId = new Map(players.map((player) => [player.id, player]));
  const counts = new Map<string, number>();
  for (const pick of state.picks) {
    if (pick.participantId !== participantId) continue;
    const club = byId.get(pick.playerId)?.club;
    if (club === undefined) continue;
    counts.set(club, (counts.get(club) ?? 0) + 1);
  }
  return counts;
}

/** How many players a participant already took from a club. */
export function clubPickCount(
  state: DraftState,
  participantId: string,
  club: string,
  players: readonly Player[],
): number {
  return clubCounts(state, participantId, players).get(club) ?? 0;
}

/**
 * Clubs the wheel may land on for the current picker: they must still have a
 * free player. With repeats off, clubs the picker already used drop out — with
 * repeats on they stay in, and a full quota is handled as a forced reroll.
 */
export function rollableClubs(
  state: DraftState,
  players: readonly Player[],
): string[] {
  const picker = currentParticipantId(state);
  if (picker === undefined) return [];

  const rules = randomTeamsRules(state.config);
  const clubs = eligibleClubs(remainingPlayers(state, players));

  if (rules.allowRepeatTeams) return clubs;
  return clubs.filter(
    (club) => clubPickCount(state, picker, club, players) === 0,
  );
}

/** True when the rolled club is at the picker's quota — they must roll again. */
export function isClubExhausted(
  state: DraftState,
  players: readonly Player[],
): boolean {
  const picker = currentParticipantId(state);
  const club = state.randomTeams.club;
  if (picker === undefined || club === null) return false;

  const rules = randomTeamsRules(state.config);
  const taken = clubPickCount(state, picker, club, players);
  const clubHasPlayers = remainingPlayers(state, players).some(
    (player) => player.club === club,
  );
  return taken >= rules.maxPlayersPerTeam || !clubHasPlayers;
}

export function rerollsLeft(state: DraftState): number {
  const picker = currentParticipantId(state);
  return picker === undefined
    ? 0
    : (state.randomTeams.rerollsLeft[picker] ?? 0);
}

/**
 * Rolls the club for the current pick. A right is only spent when the picker
 * *chooses* to swap a club they could still use — being handed a club they have
 * already filled their quota from is not their doing, so that swap is free.
 */
export function rollClub(
  state: DraftState,
  players: readonly Player[],
  rng: Rng,
  { reroll = false }: { reroll?: boolean } = {},
): DraftState {
  const picker = currentParticipantId(state);
  if (picker === undefined) {
    throw new DraftSetupError('Draft is already complete');
  }
  if (!reroll && state.randomTeams.club !== null) {
    throw new DraftSetupError('A club is already on the board for this pick');
  }

  const options = rollableClubs(state, players).filter(
    (club) => !reroll || club !== state.randomTeams.club,
  );
  if (options.length === 0) {
    throw new DraftSetupError('No club left to roll');
  }

  const left = state.randomTeams.rerollsLeft[picker] ?? 0;
  const free = isRerollFree(state, players);
  return {
    ...state,
    randomTeams: {
      rerollsLeft: {
        ...state.randomTeams.rerollsLeft,
        [picker]: reroll && !free ? Math.max(0, left - 1) : left,
      },
      club: pickRandom(options, rng),
    },
  };
}

/** True when swapping the club on the board costs no right (it is unusable). */
export function isRerollFree(
  state: DraftState,
  players: readonly Player[],
): boolean {
  return state.randomTeams.club !== null && isClubExhausted(state, players);
}

export interface InitDraftArgs {
  config: DraftConfig;
  participants: Participant[];
  players: Player[];
  /** Pre-drawn order (from the wheel). Defaults to a fresh random draw. */
  order?: string[];
  seed?: number;
}

export function initDraft({
  config,
  participants,
  players,
  order,
  seed = randomSeed(),
}: InitDraftArgs): DraftState {
  if (participants.length < 2) {
    throw new DraftSetupError('A draft needs at least 2 participants');
  }
  const pool = players.filter((p) => p.gameVersion === config.gameVersion);
  if (pool.length < participants.length * config.playersPerTeam) {
    throw new DraftSetupError('Not enough players in the pool for this draft');
  }

  const rng = createRng(seed);
  const pickOrder = order ?? drawOrder(participants, rng);
  const state: DraftState = {
    config,
    participants,
    order: pickOrder,
    sequence: buildSequence(
      pickOrder,
      config.playersPerTeam,
      config.draftOrder.pickPattern ?? 'straight',
    ),
    picks: [],
    currentIndex: 0,
    randomTeams: { rerollsLeft: {}, club: null },
    assignedSquads: {},
    seed,
  };

  if (config.draftStyle === 'randomTeams') {
    const rules = randomTeamsRules(config);
    const clubs = eligibleClubs(pool);
    // Without repeats every player of a squad must come from a different club.
    const clubsNeeded = rules.allowRepeatTeams
      ? Math.ceil(config.playersPerTeam / rules.maxPlayersPerTeam)
      : config.playersPerTeam;
    if (clubs.length < clubsNeeded) {
      throw new DraftSetupError(
        `Random Teams needs at least ${clubsNeeded} clubs in the pool`,
      );
    }
    participants.forEach((participant) => {
      state.randomTeams.rerollsLeft[participant.id] = rules.rerolls;
    });
  }

  if (config.draftStyle === 'gambler') {
    // No picking at all: everyone is dealt a finished squad. Dealing from one
    // shrinking pool keeps the squads disjoint.
    const remaining = shuffle(pool, rng);
    participants.forEach((participant) => {
      state.assignedSquads[participant.id] = dealSquad(
        remaining,
        config.playersPerTeam,
        rng,
      ).map((player) => player.id);
    });
  }

  state.constraint = rollConstraint(state, pool, rng);
  return state;
}

/** Players still on the board (nobody has picked them). */
export function remainingPlayers(
  state: DraftState,
  players: readonly Player[],
): Player[] {
  const taken = new Set(state.picks.map((pick) => pick.playerId));
  return players.filter(
    (player) =>
      player.gameVersion === state.config.gameVersion && !taken.has(player.id),
  );
}

/** What the current picker may choose from, after style + constraint filtering. */
export function availablePlayers(
  state: DraftState,
  players: readonly Player[],
): Player[] {
  const picker = currentParticipantId(state);
  if (picker === undefined) return [];

  let available = remainingPlayers(state, players);

  switch (state.config.draftStyle) {
    case 'randomTeams': {
      // Nothing to pick before the club is rolled, or once it is used up.
      const club = state.randomTeams.club;
      if (club === null || isClubExhausted(state, players)) return [];
      available = available.filter((player) => player.club === club);
      break;
    }
    case 'gambler': {
      const squad = new Set(state.assignedSquads[picker] ?? []);
      available = available.filter((player) => squad.has(player.id));
      break;
    }
    case 'randomPosition': {
      available = applyConstraint(available, state.constraint);
      break;
    }
    case 'yourChoice': {
      // Free pick of the whole pool, except that one club may only supply so
      // many players — the board keeps them visible and explains the block.
      const limit = yourChoiceLimit(state.config);
      const taken = clubCounts(state, picker, players);
      available = available.filter(
        (player) => (taken.get(player.club) ?? 0) < limit,
      );
      break;
    }
  }

  return available;
}

export function applyConstraint(
  players: readonly Player[],
  constraint: PickConstraint | undefined,
): Player[] {
  if (!constraint) return [...players];
  return players.filter(
    (player) =>
      (constraint.position === undefined ||
        player.position === constraint.position) &&
      (constraint.minRating === undefined ||
        player.rating >= constraint.minRating) &&
      (constraint.maxRating === undefined ||
        player.rating <= constraint.maxRating),
  );
}

export function currentParticipantId(state: DraftState): string | undefined {
  return state.sequence[state.currentIndex];
}

export function currentRound(state: DraftState): number {
  return Math.floor(state.currentIndex / state.participants.length) + 1;
}

export function isComplete(state: DraftState): boolean {
  return state.currentIndex >= state.sequence.length;
}

/** Applies a pick and returns a new state (never mutates the old one). */
export function pick(
  state: DraftState,
  playerId: number,
  players: readonly Player[],
): DraftState {
  const participantId = currentParticipantId(state);
  if (participantId === undefined) {
    throw new DraftSetupError('Draft is already complete');
  }
  if (
    !availablePlayers(state, players).some((player) => player.id === playerId)
  ) {
    throw new DraftSetupError(
      `Player ${playerId} is not available for this pick`,
    );
  }

  const next: DraftState = {
    ...state,
    picks: [
      ...state.picks,
      {
        index: state.currentIndex,
        round: currentRound(state),
        participantId,
        playerId,
      },
    ],
    currentIndex: state.currentIndex + 1,
    // The next picker rolls their own club.
    randomTeams: { ...state.randomTeams, club: null },
  };

  // Re-roll the Random Position constraint against what is left.
  next.constraint = rollConstraint(
    next,
    remainingPlayers(next, players),
    createRng(state.seed + next.currentIndex),
  );
  return next;
}

/** Auto-pick for a participant (used by Preset teams, and handy for testing). */
export function autoPick(
  state: DraftState,
  players: readonly Player[],
  rng: Rng,
): DraftState {
  let current = state;

  if (current.config.draftStyle === 'randomTeams') {
    if (current.randomTeams.club === null) {
      current = rollClub(current, players, rng);
    }
    // Rolled onto a club they have used up: reroll until something sticks.
    let guard = 0;
    while (isClubExhausted(current, players) && guard++ < 50) {
      current = rollClub(current, players, rng, { reroll: true });
    }
  }

  // A Gambler squad was dealt in shape order, so it is taken in that order too
  // — otherwise a random draw would shuffle the eleven in among the subs.
  if (current.config.draftStyle === 'gambler') {
    const picker = currentParticipantId(current);
    const dealt = picker ? (current.assignedSquads[picker] ?? []) : [];
    const taken = new Set(current.picks.map((p) => p.playerId));
    const nextUp = dealt.find((id) => !taken.has(id));
    if (nextUp !== undefined) return pick(current, nextUp, players);
  }

  const options = availablePlayers(current, players);
  if (options.length === 0) {
    throw new DraftSetupError('No available player to auto-pick');
  }
  return pick(current, pickRandom(options, rng).id, players);
}

export function squads(
  state: DraftState,
  players: readonly Player[],
): Record<string, Player[]> {
  const byId = new Map(players.map((player) => [player.id, player]));
  const result: Record<string, Player[]> = {};
  for (const participant of state.participants) {
    result[participant.id] = [];
  }
  for (const p of state.picks) {
    const player = byId.get(p.playerId);
    if (player) {
      result[p.participantId]!.push(player);
    }
  }
  return result;
}

export function squadRating(players: readonly Player[]): number {
  if (players.length === 0) return 0;
  return Math.round(
    players.reduce((sum, p) => sum + p.rating, 0) / players.length,
  );
}

/**
 * Random Position: roll a position + a ±2 rating band that still has players in it.
 * Falls back to position-only, then to no constraint, so a draft can never dead-end.
 */
function rollConstraint(
  state: DraftState,
  remaining: readonly Player[],
  rng: Rng,
): PickConstraint | undefined {
  if (state.config.draftStyle !== 'randomPosition' || isComplete(state)) {
    return undefined;
  }
  for (let attempt = 0; attempt < 25; attempt++) {
    const position = pickRandom(POSITIONS, rng);
    const candidates = remaining.filter(
      (player) => player.position === position,
    );
    if (candidates.length === 0) continue;
    const center = pickRandom(candidates, rng).rating;
    const constraint: PickConstraint = {
      position,
      minRating: center - 2,
      maxRating: center + 2,
    };
    if (applyConstraint(candidates, constraint).length > 0) {
      return constraint;
    }
  }
  const fallback = POSITIONS.find((position) =>
    remaining.some((player) => player.position === position),
  );
  return fallback ? { position: fallback } : undefined;
}
