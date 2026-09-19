import type { Player } from '@dreamdraft/shared';
import { apiGet } from './client';

export function fetchPlayers(signal?: AbortSignal): Promise<Player[]> {
  return apiGet<Player[]>('/players', signal);
}
