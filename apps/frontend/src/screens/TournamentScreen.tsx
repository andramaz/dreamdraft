import {
  champion,
  currentPhase,
  leagueFixtures,
  leagueRounds,
  standings,
  type TournamentState,
} from '@dreamdraft/shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bracket } from '../components/Bracket';
import { Button } from '../components/Button';
import { FixtureRow } from '../components/FixtureRow';
import { StandingsTable } from '../components/StandingsTable';
import { ChampionScreen } from './ChampionScreen';

interface TournamentScreenProps {
  state: TournamentState;
  onScore: (
    fixtureId: string,
    home: number | null,
    away: number | null,
  ) => void;
  onShootout: (tieId: string, participantId: string | null) => void;
  onSquads: () => void;
  onRestart: () => void;
}

export function TournamentScreen({
  state,
  onScore,
  onShootout,
  onSquads,
  onRestart,
}: TournamentScreenProps) {
  const { t } = useTranslation();

  const nameOf = useMemo(() => {
    const names = new Map(state.participants.map((p) => [p.id, p.name]));
    return (participantId: string) => names.get(participantId) ?? participantId;
  }, [state.participants]);

  const winner = champion(state);
  const competition = t(`draft.format.${state.format}`);

  if (winner) {
    return (
      <ChampionScreen
        winner={nameOf(winner)}
        competition={competition}
        onSquads={onSquads}
        onRestart={onRestart}
      />
    );
  }

  const phase = currentPhase(state);
  const table = standings(state);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-extrabold tracking-wide text-white uppercase">
            {competition}
          </h2>
          {state.format === 'ucl' && (
            <p className="mt-1 text-sm text-star">
              {phase === 'league'
                ? t('tournament.leaguePhase')
                : t('tournament.knockoutPhase')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={onSquads}>
            {t('tournament.squads')}
          </Button>
          <Button variant="ghost" onClick={onRestart}>
            {t('results.newDraft')}
          </Button>
        </div>
      </header>

      {phase === 'knockout' ? (
        <>
          <Bracket
            state={state}
            nameOf={nameOf}
            onScore={onScore}
            onShootout={onShootout}
          />
          {state.format === 'ucl' && (
            <details className="panel px-4 py-3">
              <summary className="cursor-pointer font-display text-sm font-bold tracking-wide text-silver uppercase">
                {t('tournament.finalTable')}
              </summary>
              <div className="mt-3">
                <StandingsTable
                  rows={table}
                  nameOf={nameOf}
                  qualifiers={state.qualifiers}
                />
              </div>
            </details>
          )}
        </>
      ) : (
        <LeaguePhase
          state={state}
          nameOf={nameOf}
          onScore={onScore}
          table={table}
        />
      )}
    </section>
  );
}

interface LeaguePhaseProps {
  state: TournamentState;
  nameOf: (participantId: string) => string;
  onScore: (
    fixtureId: string,
    home: number | null,
    away: number | null,
  ) => void;
  table: ReturnType<typeof standings>;
}

function LeaguePhase({ state, nameOf, onScore, table }: LeaguePhaseProps) {
  const { t } = useTranslation();
  const fixtures = leagueFixtures(state);
  const rounds = Array.from(
    { length: leagueRounds(state) },
    (_, index) => index + 1,
  );
  const remaining = fixtures.filter((fixture) => fixture.homeGoals === null);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <div className="flex flex-col gap-4">
        <h3 className="font-display text-sm font-bold tracking-widest text-star uppercase">
          {t('tournament.fixtures')}
        </h3>
        {rounds.map((round) => (
          <article key={round} className="panel px-4 py-3">
            <h4 className="mb-2 font-display text-xs font-bold tracking-widest text-silver/70 uppercase">
              {t('tournament.week', { number: round })}
            </h4>
            <ul className="flex flex-col gap-2">
              {fixtures
                .filter((fixture) => fixture.round === round)
                .map((fixture) => (
                  <FixtureRow
                    key={fixture.id}
                    fixture={fixture}
                    nameOf={nameOf}
                    onScore={(home, away) => onScore(fixture.id, home, away)}
                  />
                ))}
            </ul>
          </article>
        ))}
      </div>

      <aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
        <h3 className="font-display text-sm font-bold tracking-widest text-star uppercase">
          {t('tournament.standings')}
        </h3>
        <div className="panel px-4 py-3">
          <StandingsTable
            rows={table}
            nameOf={nameOf}
            qualifiers={state.format === 'ucl' ? state.qualifiers : 0}
          />
        </div>
        {state.format === 'ucl' && (
          <p className="rounded-xl border border-star/30 bg-star/5 px-4 py-3 text-sm text-star">
            {remaining.length > 0
              ? t('tournament.qualifyNote', {
                  top: state.qualifiers,
                  remaining: remaining.length,
                })
              : t('tournament.leagueDone')}
          </p>
        )}
      </aside>
    </div>
  );
}
