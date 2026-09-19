import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { PlayersModule } from './players/players.module.js';

@Module({
  imports: [PlayersModule],
  controllers: [HealthController],
})
export class AppModule {}
