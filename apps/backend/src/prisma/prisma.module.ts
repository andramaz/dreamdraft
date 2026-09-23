import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/** Global: every feature module that reads the pool needs the same client. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
