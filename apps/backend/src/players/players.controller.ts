import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  GAME_VERSIONS,
  isPosition,
  type GameVersion,
  type Player,
} from '@dreamdraft/shared';
import { PlayersService } from './players.service.js';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  // GET /api/players?gameVersion=FC26&position=ST&club=Arsenal
  @Get()
  findAll(
    @Query('gameVersion') gameVersion?: string,
    @Query('position') position?: string,
    @Query('club') club?: string,
  ): Promise<Player[]> {
    if (
      gameVersion !== undefined &&
      !(GAME_VERSIONS as readonly string[]).includes(gameVersion)
    ) {
      throw new BadRequestException(`Unknown gameVersion: ${gameVersion}`);
    }
    if (position !== undefined && !isPosition(position)) {
      throw new BadRequestException(`Unknown position: ${position}`);
    }

    return this.playersService.findAll({
      gameVersion: gameVersion as GameVersion | undefined,
      position,
      club,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Player> {
    return this.playersService.findOne(id);
  }
}
