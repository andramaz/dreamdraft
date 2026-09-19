import { useTranslation } from 'react-i18next';
import { Button } from './components/Button';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { StarField } from './components/StarField';
import { useDraftFlow } from './draft/useDraftFlow';
import { usePlayers } from './hooks/usePlayers';
import { DraftScreen } from './screens/DraftScreen';
import { DrawScreen } from './screens/DrawScreen';
import { ResultsScreen } from './screens/ResultsScreen';
import { TournamentScreen } from './screens/TournamentScreen';
import { WizardScreen } from './screens/WizardScreen';

export default function App() {
  const { t } = useTranslation();
  const { state: poolState, retry } = usePlayers();
  const players = poolState.status === 'success' ? poolState.players : [];
  const flow = useDraftFlow(players);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6">
      <StarField />

      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="bg-linear-to-r from-white via-star to-magenta bg-clip-text font-display text-3xl font-extrabold tracking-wider text-transparent uppercase drop-shadow-[0_0_25px_rgba(76,201,255,0.35)] sm:text-4xl">
            {t('app.title')}
          </h1>
          <p className="mt-1 text-sm text-silver/70">{t('app.tagline')}</p>
        </div>
        <div className="flex items-center gap-3">
          {(flow.phase.name === 'draw' || flow.phase.name === 'draft') && (
            <Button variant="ghost" onClick={flow.restart}>
              {t('wizard.start')}
            </Button>
          )}
          <LanguageSwitcher />
        </div>
      </header>

      <main>
        {poolState.status === 'loading' && (
          <p className="py-24 text-center text-silver/70">
            {t('players.loading')}
          </p>
        )}

        {poolState.status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <p className="text-red-300">{t('players.error')}</p>
            <Button variant="ghost" onClick={retry}>
              {t('players.retry')}
            </Button>
          </div>
        )}

        {poolState.status === 'success' && (
          <>
            {flow.error && (
              <p className="mb-4 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {flow.error}
              </p>
            )}

            {flow.phase.name === 'wizard' && (
              <WizardScreen players={players} onStart={flow.start} />
            )}

            {flow.phase.name === 'draw' && (
              <DrawScreen
                participants={flow.phase.participants}
                onDone={(order) => {
                  if (flow.phase.name !== 'draw') return;
                  flow.begin(flow.phase.config, flow.phase.participants, order);
                }}
              />
            )}

            {flow.phase.name === 'draft' && flow.state && (
              <DraftScreen
                state={flow.state}
                players={players}
                onPick={flow.makePick}
                onRoll={flow.roll}
                onUndo={flow.undo}
                canUndo={flow.canUndo}
                formations={flow.formations}
                onFormationChange={flow.setFormation}
              />
            )}

            {flow.phase.name === 'results' && flow.state && (
              <ResultsScreen
                state={flow.state}
                players={players}
                formations={flow.formations}
                onFormationChange={flow.setFormation}
                onRestart={flow.restart}
                onTournament={
                  flow.tournament ? flow.showTournament : flow.startTournament
                }
                tournamentStarted={flow.tournament !== null}
              />
            )}

            {flow.phase.name === 'tournament' && flow.tournament && (
              <TournamentScreen
                state={flow.tournament}
                onScore={flow.scoreFixture}
                onShootout={flow.pickShootoutWinner}
                onSquads={flow.showSquads}
                onRestart={flow.restart}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
