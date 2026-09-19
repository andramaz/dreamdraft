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
