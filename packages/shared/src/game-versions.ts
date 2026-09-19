export const GAME_VERSIONS = ['FC26', 'FC27'] as const;

export type GameVersion = (typeof GAME_VERSIONS)[number];
