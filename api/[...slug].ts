import type { IncomingMessage, ServerResponse } from 'node:http';
// The compiled backend, not its source: Nest's dependency injection reads the
// types that `emitDecoratorMetadata` writes out, and the esbuild pass Vercel
// runs over this directory cannot produce that metadata. `nest build` can, so
// the build command runs first and this file only picks up the output.
import { createApp } from '../apps/backend/dist/create-app.js';

type NodeHandler = (request: IncomingMessage, response: ServerResponse) => void;

/**
 * One Nest application per cold start, shared by every request that instance
 * goes on to serve. Booting it per request would put the whole module graph in
 * front of each call.
 */
let booting: Promise<NodeHandler> | undefined;

async function boot(): Promise<NodeHandler> {
  const app = await createApp();
  // Not `listen`: the platform owns the socket. `init` is the half of it we
  // want — modules resolved, routes registered on the Express instance.
  await app.init();
  return app.getHttpAdapter().getInstance() as NodeHandler;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    booting ??= boot();
    const express = await booting;
    express(request, response);
  } catch (error) {
    // A failed boot must not be cached, or the instance would answer every
    // later request with the same stale failure.
    booting = undefined;
    throw error;
  }
}
