import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { PlayersModule } from './players/players.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, PlayersModule],
  controllers: [HealthController],
})
export class AppModule {}
