import type { GameVersion } from './game-versions.js';
import type { Position } from './positions.js';

export const STAT_KEYS = [
  'pace',
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'physical',
] as const;

export type StatKey = (typeof STAT_KEYS)[number];

/** Player as returned by the API (mirrors the Prisma `Player` model). */
export interface Player {
  id: number;
  name: string;
  position: Position;
  rating: number;
  club: string;
  gameVersion: GameVersion;
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physical: number | null;
  photoUrl: string | null;
}

/**
 * What a goalkeeper's six numbers actually are.
 *
 * EA returns a keeper in the same six fields as everyone else, but they hold
 * the keeper card: `pace` is his diving, `defending` is his speed. Reading
 * them as an outfielder's makes Alisson look like a 50-rated defender. The
 * values and their order are right — only the names are wrong — so this maps
 * the field to the label it should wear, and the card looks it up by position.
 */
const KEEPER_LABELS = {
  pace: 'diving',
  shooting: 'handling',
  passing: 'kicking',
  dribbling: 'reflexes',
  defending: 'speed',
  physical: 'positioning',
} as const satisfies Record<StatKey, string>;

/** Every name a stat can wear. The frontend's translation keys are these. */
export type StatLabel = StatKey | (typeof KEEPER_LABELS)[StatKey];

/** The label a stat wears for this position: `pace`, or `diving` for a keeper. */
export function statLabel(position: Position, key: StatKey): StatLabel {
  return position === 'GK' ? KEEPER_LABELS[key] : key;
}
