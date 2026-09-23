import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from './app.module.js';

/**
 * The application with no transport attached yet.
 *
 * Two things start it: `main.ts`, which puts it behind a listening port for
 * local development, and the Vercel function in `api/`, which hands it one
 * request at a time and never listens on anything. Whatever must hold for both
 * — the `/api` prefix, CORS — belongs here rather than in either caller.
 */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim()),
  });

  return app;
}
