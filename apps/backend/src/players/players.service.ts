import { Injectable, NotFoundException } from '@nestjs/common';
import type { GameVersion, Player, Position } from '@dreamdraft/shared';
import { PrismaService } from '../prisma/prisma.service.js';

export interface PlayerFilter {
  gameVersion?: GameVersion;
  position?: Position;
  club?: string;
}

/** The columns the API returns; the rest of the row stays in the database. */
const SELECT = {
  id: true,
  name: true,
  position: true,
  rating: true,
  club: true,
  gameVersion: true,
  pace: true,
  shooting: true,
  passing: true,
  dribbling: true,
  defending: true,
  physical: true,
  photoUrl: true,
} as const;

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: PlayerFilter = {}): Promise<Player[]> {
    const rows = await this.prisma.player.findMany({
      where: {
        ...(filter.gameVersion ? { gameVersion: filter.gameVersion } : {}),
        ...(filter.position ? { position: filter.position } : {}),
        ...(filter.club ? { club: filter.club } : {}),
      },
      select: SELECT,
      orderBy: [{ rating: 'desc' }, { id: 'asc' }],
    });
    return rows as Player[];
  }

  async findOne(id: number): Promise<Player> {
    const player = await this.prisma.player.findUnique({
      where: { id },
      select: SELECT,
    });
    if (!player) {
      throw new NotFoundException(`Player ${id} not found`);
    }
    return player as Player;
  }
}
