import { Injectable, NotFoundException } from '@nestjs/common';
import type { GameVersion, Player, Position } from '@dreamdraft/shared';
import { PLAYERS } from './data/players.data.js';

export interface PlayerFilter {
  gameVersion?: GameVersion;
  position?: Position;
  club?: string;
}

/**
 * Serves static fake data for now. Will be swapped for Prisma reads once the
 * database is wired in — the controller contract stays the same.
 */
@Injectable()
export class PlayersService {
  findAll(filter: PlayerFilter = {}): Player[] {
    return PLAYERS.filter(
      (p) =>
        (!filter.gameVersion || p.gameVersion === filter.gameVersion) &&
        (!filter.position || p.position === filter.position) &&
        (!filter.club || p.club === filter.club),
    ).sort((a, b) => b.rating - a.rating);
  }

  findOne(id: number): Player {
    const player = PLAYERS.find((p) => p.id === id);
    if (!player) {
      throw new NotFoundException(`Player ${id} not found`);
    }
    return player;
  }
}
