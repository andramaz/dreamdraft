import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * The Prisma client as a Nest provider.
 *
 * Prisma 7 takes a driver adapter rather than a url in the schema, so the
 * connection string is read here. It must be the **pooled** one: the app runs
 * as a Vercel function, and a fresh Postgres connection per cold start is what
 * exhausts a small instance.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      // Failing here is the point: a silent fall back to an empty pool would
      // look like a draft with no players rather than a missing setting.
      throw new Error(
        'DATABASE_URL is not set. See DEPLOY.md for where the connection ' +
          'string comes from.',
      );
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
