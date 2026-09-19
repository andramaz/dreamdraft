import { createRng, type Player, type Position } from '@dreamdraft/shared';

// Fake player pool for scaffolding (build order step 1).
// Generated deterministically from a fixed seed, so ids/ratings stay stable
// across restarts. Names are synthetic — real stats arrive with the scraper.

interface ClubSeed {
  name: string;
  /** Average squad rating the club is built around. */
  strength: number;
}

const CLUBS: ClubSeed[] = [
  { name: 'Real Madrid', strength: 84 },
  { name: 'Manchester City', strength: 84 },
  { name: 'FC Barcelona', strength: 83 },
  { name: 'FC Bayern München', strength: 83 },
  { name: 'Liverpool', strength: 83 },
  { name: 'Paris Saint-Germain', strength: 82 },
  { name: 'Arsenal', strength: 82 },
  { name: 'Inter', strength: 81 },
  { name: 'Atlético Madrid', strength: 81 },
  { name: 'Chelsea', strength: 80 },
  { name: 'Juventus', strength: 80 },
  { name: 'Manchester United', strength: 79 },
  { name: 'Borussia Dortmund', strength: 79 },
  { name: 'Napoli', strength: 79 },
  { name: 'AC Milan', strength: 78 },
  { name: 'Tottenham Hotspur', strength: 78 },
  { name: 'Galatasaray', strength: 77 },
  { name: 'Fenerbahçe', strength: 77 },
  { name: 'Benfica', strength: 76 },
  { name: 'Ajax', strength: 75 },
];

/** 20 players per club — enough for the max squad size (18) in Random Teams. */
const SQUAD_TEMPLATE: Position[] = [
  'GK',
  'GK',
  'RB',
  'RB',
  'CB',
  'CB',
  'CB',
  'LB',
  'LB',
  'CDM',
  'CDM',
  'CM',
  'CM',
  'CAM',
  'RM',
  'LM',
  'RW',
  'LW',
  'ST',
  'ST',
];

const FIRST_NAMES = [
  'Lucas',
  'Mateo',
  'Diego',
  'Rafael',
  'Andrés',
  'Emre',
  'Kerem',
  'Arda',
  'Luka',
  'Marco',
  'Nico',
  'Julian',
  'Felix',
  'Thomas',
  'Owen',
  'Callum',
  'Jordan',
  'Malik',
  'Ibrahim',
  'Youssef',
  'Kai',
  'Noah',
  'Elias',
  'Milan',
  'Viktor',
  'Pavel',
  'Stefan',
  'Gabriel',
  'Hugo',
  'Tobias',
];

const LAST_NAMES = [
  'Moreno',
  'Silva',
  'Costa',
  'Ferreira',
  'Rossi',
  'Bianchi',
  'Romano',
  'Müller',
  'Schmidt',
  'Wagner',
  'Fischer',
  'Dupont',
  'Girard',
  'Lefèvre',
  'Yılmaz',
  'Demir',
  'Kaya',
  'Çelik',
  'Novak',
  'Horvat',
  'Kovač',
  'Petrov',
  'Ivanov',
  'Nowak',
  'Walsh',
  'Hughes',
  'Carter',
  'Bennett',
  'Osei',
  'Mensah',
  'Diallo',
  'Traoré',
  'Haddad',
  'Nakamura',
  'Larsen',
  'Berg',
  'Lindqvist',
  'Van Dijk',
  'De Boer',
  'Janssen',
];

/** Stat profile per position: offsets applied to the player's rating. */
const PROFILES: Record<Position, Record<keyof StatBlock, number>> = {
  GK: {
    pace: -5,
    shooting: -2,
    passing: -10,
    dribbling: -3,
    defending: -35,
    physical: 2,
  },
  RB: {
    pace: 6,
    shooting: -18,
    passing: -2,
    dribbling: -3,
    defending: 1,
    physical: -2,
  },
  CB: {
    pace: -6,
    shooting: -30,
    passing: -10,
    dribbling: -12,
    defending: 5,
    physical: 6,
  },
  LB: {
    pace: 6,
    shooting: -18,
    passing: -2,
    dribbling: -3,
    defending: 1,
    physical: -2,
  },
  CDM: {
    pace: -6,
    shooting: -12,
    passing: 1,
    dribbling: -4,
    defending: 4,
    physical: 4,
  },
  CM: {
    pace: -2,
    shooting: -6,
    passing: 4,
    dribbling: 2,
    defending: -6,
    physical: 0,
  },
  CAM: {
    pace: 1,
    shooting: 0,
    passing: 4,
    dribbling: 5,
    defending: -18,
    physical: -6,
  },
  RM: {
    pace: 6,
    shooting: -4,
    passing: 1,
    dribbling: 4,
    defending: -16,
    physical: -6,
  },
  LM: {
    pace: 6,
    shooting: -4,
    passing: 1,
    dribbling: 4,
    defending: -16,
    physical: -6,
  },
  RW: {
    pace: 8,
    shooting: 1,
    passing: -1,
    dribbling: 6,
    defending: -24,
    physical: -8,
  },
  LW: {
    pace: 8,
    shooting: 1,
    passing: -1,
    dribbling: 6,
    defending: -24,
    physical: -8,
  },
  ST: {
    pace: 4,
    shooting: 6,
    passing: -8,
    dribbling: 1,
    defending: -30,
    physical: 3,
  },
};

interface StatBlock {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(value)));

function generatePlayers(): Player[] {
  const rng = createRng(20260917);
  const players: Player[] = [];
  const usedNames = new Set<string>();
  let id = 1;

  for (const club of CLUBS) {
    SQUAD_TEMPLATE.forEach((position, indexInSquad) => {
      // Starters (first of each position) are rated above the squad average.
      const isStarter = indexInSquad < 11;
      const rating = clamp(
        club.strength + (isStarter ? 3 : -3) + (rng() * 10 - 5),
        62,
        94,
      );

      let name = `${FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]} ${
        LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]
      }`;
      while (usedNames.has(name)) {
        name = `${FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]} ${
          LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]
        }`;
      }
      usedNames.add(name);

      const profile = PROFILES[position];
      const stat = (key: keyof StatBlock) =>
        clamp(rating + profile[key] + (rng() * 8 - 4), 20, 99);

      players.push({
        id: id++,
        name,
        position,
        rating,
        club: club.name,
        gameVersion: 'FC26',
        pace: stat('pace'),
        shooting: stat('shooting'),
        passing: stat('passing'),
        dribbling: stat('dribbling'),
        defending: stat('defending'),
        physical: stat('physical'),
        photoUrl: null,
      });
    });
  }

  return players;
}

export const PLAYERS: Player[] = generatePlayers();
