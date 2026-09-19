/**
 * Canonical position keys. The backend only ever sends these keys;
 * the frontend maps them to translated labels (see i18n `positions.*`).
 */
export const POSITIONS = [
  'GK',
  'RB',
  'CB',
  'LB',
  'CDM',
  'CM',
  'CAM',
  'RM',
  'LM',
  'RW',
  'LW',
  'ST',
] as const;

export type Position = (typeof POSITIONS)[number];

export function isPosition(value: string): value is Position {
  return (POSITIONS as readonly string[]).includes(value);
}
