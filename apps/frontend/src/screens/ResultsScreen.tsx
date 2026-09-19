import {
  formationOf,
  squadRating,
  squads,
  type DraftState,
  type Player,
} from '@dreamdraft/shared';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { FormationBoard, FormationOverlay } from '../components/FormationBoard';
import { defaultChoice, type FormationChoice } from '../components/formation';
import { PlayerRow } from '../components/PlayerCard';

interface ResultsScreenProps {
  state: DraftState;
  players: Player[];
  /** Pitch layouts, shared with the draft board. */
  formations: Record<string, FormationChoice>;
  onFormationChange: (participantId: string, choice: FormationChoice) => void;
  onRestart: () => void;
  /** Draws the fixtures and opens the tournament. Tournament mode only. */
  onTournament: () => void;
  /** True once the fixtures exist, so the button goes back instead. */
  tournamentStarted: boolean;
}

export function ResultsScreen({
  state,
  players,
  formations,
  onFormationChange,
  onRestart,
  onTournament,
  tournamentStarted,
}: ResultsScreenProps) {
  const { t } = useTranslation();
  const result = useMemo(() => squads(state, players), [state, players]);
  const isGambler = state.config.draftStyle === 'gambler';
  const [openSquad, setOpenSquad] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-3xl font-extrabold tracking-wide text-white uppercase">
          {t('results.title')}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {state.config.mode === 'tournament' && (
            <Button onClick={onTournament}>
              {tournamentStarted
                ? t('results.backToTournament')
                : t('results.startTournament')}
            </Button>
          )}
          <Button variant="ghost" onClick={onRestart}>
            {t('results.newDraft')}
          </Button>
        </div>
      </header>

      {state.config.mode === 'tournament' && !tournamentStarted && (
        <p className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-gold">
          {t('results.tournamentNote')}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {state.order.map((participantId, index) => {
          const participant = state.participants.find(
            (p) => p.id === participantId,
          )!;
          const dealt = result[participantId] ?? [];
          // A Gambler squad is dealt shape first, bench after, so that order
          // carries meaning. Every other style has none, and reads best by
          // rating.
          const squad = isGambler
            ? dealt
            : [...dealt].sort((a, b) => b.rating - a.rating);
          const eleven = isGambler ? squad.slice(0, 11) : squad;
          const bench = isGambler ? squad.slice(11) : [];
          const formation = isGambler ? formationOf(squad) : undefined;
          return (
            <article
              key={participantId}
              className="flex flex-col rounded-2xl border border-white/15 bg-white/8 p-4"
            >
              <header className="flex items-center justify-between gap-2 border-b border-white/15 pb-3">
                <span className="truncate font-display text-lg font-bold text-white">
                  {index + 1}. {participant.name}
                </span>
                <span
                  className="font-display text-2xl font-extrabold text-gold"
                  title={t('results.avg')}
                >
                  {squadRating(squad)}
                </span>
              </header>
              {squad.length === 0 ? (
                <p className="py-6 text-center text-sm text-silver/60">
                  {t('results.empty')}
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setOpenSquad(participantId)}
                    className="mt-3 self-start rounded-lg border border-star/40 bg-star/10 px-2.5 py-1 font-display text-[0.7rem] font-bold tracking-wide text-star uppercase transition hover:border-star hover:bg-star/20"
                  >
                    {t('pitch.openShort')}
                  </button>
                  {isGambler && (
                    <p className="mt-3 font-display text-xs font-bold tracking-wide text-star uppercase">
                      {t('results.startingEleven')}
                      {formation ? ` · ${formation}` : ''}
                    </p>
                  )}
                  <ul className="mt-3 flex flex-col gap-1">
                    {eleven.map((player) => (
                      <PlayerRow key={player.id} player={player} />
                    ))}
                  </ul>
                  {bench.length > 0 && (
                    <>
                      <p className="mt-4 font-display text-xs font-bold tracking-wide text-silver/60 uppercase">
                        {t('results.bench')}
                      </p>
                      <ul className="mt-2 flex flex-col gap-1 opacity-75">
                        {bench.map((player) => (
                          <PlayerRow key={player.id} player={player} />
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>

      {openSquad && (
        <FormationOverlay onClose={() => setOpenSquad(null)}>
          <FormationBoard
            name={
              state.participants.find((p) => p.id === openSquad)?.name ?? ''
            }
            squad={result[openSquad] ?? []}
            choice={
              formations[openSquad] ?? defaultChoice(result[openSquad] ?? [])
            }
            onChange={(choice) => onFormationChange(openSquad, choice)}
            onClose={() => setOpenSquad(null)}
          />
        </FormationOverlay>
      )}
    </section>
  );
}
