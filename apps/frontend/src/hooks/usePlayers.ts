import type { Player } from '@dreamdraft/shared';
import { useCallback, useEffect, useState } from 'react';
import { fetchPlayers } from '../api/players';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'success'; players: Player[] };

export function usePlayers() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchPlayers(controller.signal)
      .then((players) => setState({ status: 'success', players }))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          console.error(err);
          setState({ status: 'error' });
        }
      });
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
