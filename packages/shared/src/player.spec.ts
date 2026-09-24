import { describe, expect, it } from 'vitest';
import { POSITIONS } from './positions.js';
import { STAT_KEYS, statLabel } from './player.js';

describe('statLabel', () => {
  it('leaves an outfielder alone', () => {
    for (const position of POSITIONS.filter((p) => p !== 'GK')) {
      for (const key of STAT_KEYS) {
        expect(statLabel(position, key)).toBe(key);
      }
    }
  });

  // The order matters as much as the names: EA returns a keeper in the
  // outfield fields, so `defending` is his speed and `pace` is his diving.
  // Getting the pairing wrong shows Alisson as a 50-rated defender.
  it('reads a keeper as a keeper', () => {
    expect(STAT_KEYS.map((key) => statLabel('GK', key))).toEqual([
      'diving',
      'handling',
      'kicking',
      'reflexes',
      'speed',
      'positioning',
    ]);
  });

  it('gives every stat its own label', () => {
    const labels = STAT_KEYS.map((key) => statLabel('GK', key));
    expect(new Set(labels).size).toBe(STAT_KEYS.length);
  });
});
