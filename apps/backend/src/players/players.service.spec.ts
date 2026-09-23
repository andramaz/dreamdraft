import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PlayersService } from './players.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * The service is a thin translation from query parameters to a Prisma query,
 * so that translation is what these check. Sorting and filtering themselves
 * are Postgres's job and are not worth a database to prove.
 */
describe('PlayersService', () => {
  let service: PlayersService;
  let lastFindMany: unknown;
  let row: Record<string, unknown> | null;

  const prisma = {
    player: {
      findMany: (args: unknown) => {
        lastFindMany = args;
        return Promise.resolve([{ id: 1, name: 'Someone', rating: 90 }]);
      },
      findUnique: () => Promise.resolve(row),
    },
  };

  beforeEach(async () => {
    lastFindMany = undefined;
    row = { id: 1, name: 'Someone', rating: 90 };
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlayersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(PlayersService);
  });

  it('asks for the whole pool, best rated first', async () => {
    await service.findAll();
    expect(lastFindMany).toMatchObject({
      where: {},
      orderBy: [{ rating: 'desc' }, { id: 'asc' }],
    });
  });

  it('turns each filter into a where clause', async () => {
    await service.findAll({ gameVersion: 'FC27', position: 'GK', club: 'PSV' });
    expect(lastFindMany).toMatchObject({
      where: { gameVersion: 'FC27', position: 'GK', club: 'PSV' },
    });
  });

  it('leaves out filters that were not given', async () => {
    await service.findAll({ position: 'ST' });
    expect((lastFindMany as { where: object }).where).toEqual({
      position: 'ST',
    });
  });

  it('returns the player it was asked for', async () => {
    await expect(service.findOne(1)).resolves.toMatchObject({ id: 1 });
  });

  it('throws for an unknown id', async () => {
    row = null;
    await expect(service.findOne(9999)).rejects.toThrow(NotFoundException);
  });
});
