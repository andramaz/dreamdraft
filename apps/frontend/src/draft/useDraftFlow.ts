import {
  autoPick,
  createRng,
  createTournament,
  initDraft,
  isComplete,
  pick,
  randomSeed,
  rollClub,
  setScore,
  setShootoutWinner,
  type DraftConfig,
  type DraftState,
  type Participant,
  type Player,
  type TournamentState,
} from '@dreamdraft/shared';
import { useCallback, useState } from 'react';
import type { FormationChoice } from '../components/formation';

export type Phase =
  | { name: 'wizard' }
  | { name: 'draw'; config: DraftConfig; participants: Participant[] }
  | { name: 'draft' }
  | { name: 'results' }
  | { name: 'tournament' };

export interface StartArgs {
  config: DraftConfig;
  participants: Participant[];
  /** Order the user arranged by hand; undefined means draw it on the wheel. */
  order?: string[];
}

/** Owns the draft flow: wizard → (wheel) → picking → squads. */
export function useDraftFlow(players: Player[]) {
  const [phase, setPhase] = useState<Phase>({ name: 'wizard' });
  const [state, setState] = useState<DraftState | null>(null);
  const [history, setHistory] = useState<DraftState[]>([]);
  const [tournament, setTournament] = useState<TournamentState | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Pitch layouts live here, not in a screen, so arranging your shape mid-draft
  // still shows up on the squads screen afterwards.
  const [formations, setFormations] = useState<Record<string, FormationChoice>>(
    {},
  );

  const setFormation = useCallback(
    (participantId: string, choice: FormationChoice) =>
      setFormations((current) => ({ ...current, [participantId]: choice })),
    [],
  );

  const begin = useCallback(
    (config: DraftConfig, participants: Participant[], order?: string[]) => {
      try {
        const seed = randomSeed();
        let next = initDraft({ config, participants, players, order, seed });

        // Gambler asks nothing of the user: the squads were dealt in initDraft,
        // so running them through just turns them into picks.
        if (config.draftStyle === 'gambler') {
          const rng = createRng(seed);
          while (!isComplete(next)) {
            next = autoPick(next, players, rng);
          }
        }

        setState(next);
        setHistory([]);
        setError(null);
        setPhase(isComplete(next) ? { name: 'results' } : { name: 'draft' });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase({ name: 'wizard' });
      }
    },
    [players],
  );

  const start = useCallback(
    ({ config, participants, order }: StartArgs) => {
      if (order === undefined) {
        setPhase({ name: 'draw', config, participants });
        return;
      }
      begin(config, participants, order);
    },
    [begin],
  );

  const advance = useCallback((previous: DraftState, next: DraftState) => {
    setHistory((current) => [...current, previous]);
    setState(next);
    if (isComplete(next)) {
      setPhase({ name: 'results' });
    }
  }, []);

  const makePick = useCallback(
    (playerId: number) => {
      if (!state) return;
      advance(state, pick(state, playerId, players));
    },
    [state, players, advance],
  );

  /** Random Teams: roll the club for this pick, or burn a right to roll again. */
  const roll = useCallback(
    (reroll = false) => {
      if (!state) return;
      setState(rollClub(state, players, createRng(randomSeed()), { reroll }));
    },
    [state, players],
  );

  const undo = useCallback(() => {
    setHistory((current) => {
      const previous = current.at(-1);
      if (!previous) return current;
      setState(previous);
      setPhase({ name: 'draft' });
      return current.slice(0, -1);
    });
  }, []);

  /** Squads are done — draw the fixtures and hand over to the tournament. */
  const startTournament = useCallback(() => {
    if (!state?.config.tournament) return;
    try {
      setTournament(
        createTournament({
          participants: state.participants,
          order: state.order,
          format: state.config.tournament.format,
          legs: state.config.tournament.knockoutLegs,
          rng: createRng(randomSeed()),
        }),
      );
      setError(null);
      setPhase({ name: 'tournament' });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [state]);

  const scoreFixture = useCallback(
    (fixtureId: string, home: number | null, away: number | null) => {
      setTournament((current) =>
        current ? setScore(current, fixtureId, home, away) : current,
      );
    },
    [],
  );

  const pickShootoutWinner = useCallback(
    (tieId: string, participantId: string | null) => {
      setTournament((current) =>
        current ? setShootoutWinner(current, tieId, participantId) : current,
      );
    },
    [],
  );

  const showSquads = useCallback(() => setPhase({ name: 'results' }), []);
  const showTournament = useCallback(
    () => setPhase({ name: 'tournament' }),
    [],
  );

  const restart = useCallback(() => {
    setState(null);
    setHistory([]);
    setTournament(null);
    setFormations({});
    setError(null);
    setPhase({ name: 'wizard' });
  }, []);

  return {
    phase,
    state,
    tournament,
    error,
    canUndo: history.length > 0,
    formations,
    setFormation,
    start,
    begin,
    makePick,
    roll,
    undo,
    restart,
    startTournament,
    scoreFixture,
    pickShootoutWinner,
    showSquads,
    showTournament,
  };
}
