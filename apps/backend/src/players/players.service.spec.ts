import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PlayersService } from './players.service.js';

describe('PlayersService', () => {
  let service: PlayersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlayersService],
    }).compile();

    service = module.get(PlayersService);
  });

  it('returns all players sorted by rating desc', () => {
    const players = service.findAll();
    expect(players.length).toBeGreaterThanOrEqual(10);
    for (let i = 1; i < players.length; i++) {
      expect(players[i - 1].rating).toBeGreaterThanOrEqual(players[i].rating);
    }
  });

  it('filters by position and club', () => {
    expect(
      service.findAll({ position: 'GK' }).every((p) => p.position === 'GK'),
    ).toBe(true);
    expect(
      service.findAll({ club: 'Arsenal' }).every((p) => p.club === 'Arsenal'),
    ).toBe(true);
  });

  it('throws for an unknown id', () => {
    expect(() => service.findOne(9999)).toThrow(NotFoundException);
  });
});
