import type { GameVersion } from './game-versions.js';

// Working draft of the draft wizard config — expect this to evolve.

export const PLAYERS_PER_TEAM_MIN = 11;
export const PLAYERS_PER_TEAM_MAX = 18;

/** Nobody drafts alone, whichever mode is picked. */
export const PARTICIPANTS_MIN = 2;
/** `match` draws no fixtures, so the roster stays small enough to sort out by hand. */
export const MATCH_PARTICIPANTS_MAX = 8;

export const TOURNAMENT_TEAMS_MIN = 2;
export const TOURNAMENT_TEAMS_MAX = 16;
/**
 * A `ucl` league phase has to send someone home, and `qualifierCount` puts two
 * teams through at the smallest sizes — so two entrants would all qualify.
 */
export const UCL_TEAMS_MIN = 3;

export const DRAFT_MODES = ['match', 'tournament'] as const;
export type DraftMode = (typeof DRAFT_MODES)[number];

/** `ucl` = league phase → knockout phase. See `tournament.ts` for the rules. */
export const TOURNAMENT_FORMATS = ['league', 'knockout', 'ucl'] as const;
export type TournamentFormat = (typeof TOURNAMENT_FORMATS)[number];

export const KNOCKOUT_LEGS = ['single', 'double'] as const;
export type KnockoutLegs = (typeof KNOCKOUT_LEGS)[number];

export const PICK_PATTERNS = ['straight', 'snake'] as const;
export type PickPattern = (typeof PICK_PATTERNS)[number];

export const DRAFT_STYLES = [
  'randomTeams',
  'yourChoice',
  'randomPosition',
  'gambler',
] as const;
export type DraftStyle = (typeof DRAFT_STYLES)[number];

export interface TournamentConfig {
  teamCount: number;
  format: TournamentFormat;
  knockoutLegs?: KnockoutLegs;
}

export const REROLLS_MIN = 3;
export const REROLLS_MAX = 6;

/** Extra rules for the Random Teams style (a club is rolled for every pick). */
export interface RandomTeamsConfig {
  /** "Another team" rights, per participant. */
  rerolls: number;
  /** May the same club be rolled again for the same participant? */
  allowRepeatTeams: boolean;
  /**
   * Max players one participant may take from a single club.
   * Only meaningful when `allowRepeatTeams` is true (otherwise it is 1).
   */
  maxPlayersPerTeam: number;
}

/** Extra rules for the Your Choice style (the picker takes whoever they like). */
export interface YourChoiceConfig {
  /**
   * Max players one participant may take from a single club. Setting it to
   * `playersPerTeam` lifts the limit, since a whole squad may then come from
   * one club.
   */
  maxPlayersPerTeam: number;
}

/** Enough to build a spine from one club without fielding all of it. */
export const YOUR_CHOICE_PER_TEAM_DEFAULT = 4;

export interface DraftOrderConfig {
  /** true = draw the order on the wheel, false = the user orders by hand. */
  randomize: boolean;
  /** Always asked, whichever way the order was decided. */
  pickPattern?: PickPattern;
}

export interface DraftConfig {
  gameVersion: GameVersion;
  mode: DraftMode;
  tournament?: TournamentConfig;
  draftOrder: DraftOrderConfig;
  draftStyle: DraftStyle;
  /** Asked only when draftStyle is 'randomTeams'. */
  randomTeams?: RandomTeamsConfig;
  /** Asked only when draftStyle is 'yourChoice'. */
  yourChoice?: YourChoiceConfig;
  /** Between PLAYERS_PER_TEAM_MIN and PLAYERS_PER_TEAM_MAX. */
  playersPerTeam: number;
}
