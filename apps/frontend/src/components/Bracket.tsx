import {
  knockoutRounds,
  tieAggregate,
  tieWinner,
  type KnockoutTie,
  type TournamentState,
} from '@dreamdraft/shared';
import { useTranslation } from 'react-i18next';
import { useRoundLabel } from './roundLabel';
import { ScoreInput } from './ScoreInput';

interface BracketProps {
  state: TournamentState;
  nameOf: (participantId: string) => string;
  onScore: (
    fixtureId: string,
    home: number | null,
    away: number | null,
  ) => void;
  onShootout: (tieId: string, participantId: string | null) => void;
}

export function Bracket({ state, nameOf, onScore, onShootout }: BracketProps) {
  const { t } = useTranslation();
  const roundLabel = useRoundLabel();
  const lastRound = knockoutRounds(state);
  const rounds = Array.from({ length: lastRound }, (_, index) => index + 1);

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="flex min-w-max items-stretch">
        {rounds.map((round) => {
          const ties = state.ties
            .filter((tie) => tie.round === round)
            .sort((a, b) => a.slot - b.slot);

          return (
            <div key={round} className="flex items-stretch">
              <div className="flex w-60 flex-col">
                <h4 className="mb-2 text-center font-display text-xs font-bold tracking-widest text-star uppercase">
                  {roundLabel(round, lastRound)}
                </h4>
                <div className="flex flex-1 flex-col justify-around gap-3">
                  {ties.map((tie) => (
                    <TieCard
                      key={tie.id}
                      tie={tie}
                      state={state}
                      nameOf={nameOf}
                      onScore={onScore}
                      onShootout={onShootout}
                    />
                  ))}
                </div>
              </div>

              {round < lastRound && (
                <div
                  aria-hidden
                  className="mt-6 flex w-6 flex-col justify-around"
                >
                  {Array.from({ length: ties.length / 2 }, (_, index) => (
                    <div
                      key={index}
                      className="my-3 flex-1 rounded-r-xl border-2 border-l-0 border-white/15"
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-silver/50">
        {t('tournament.bracketHint')}
      </p>
    </div>
  );
}

interface TieCardProps extends Omit<BracketProps, 'state'> {
  tie: KnockoutTie;
  state: TournamentState;
}

function TieCard({ tie, state, nameOf, onScore, onShootout }: TieCardProps) {
  const { t } = useTranslation();
  const legs = state.fixtures
    .filter((fixture) => fixture.tieId === tie.id)
    .sort((a, b) => a.leg - b.leg);
  const winner = tieWinner(state, tie);
  const aggregate = tieAggregate(state, tie);
  // Only the first round can hand out a bye. Later on a half-filled tie is just
  // waiting for the other side of the bracket, which is not the same thing.
  const bye = tie.round === 1 && Boolean(tie.homeId) && !tie.awayId;
  const level = aggregate.played && aggregate.home === aggregate.away && !bye;

  return (
    <article
      className={`panel px-3 py-2 ${
        winner ? 'border-gold/40 shadow-[0_0_22px] shadow-gold/10' : ''
      }`}
    >
      <TeamLine
        name={tie.homeId ? nameOf(tie.homeId) : t('tournament.tbd')}
        goals={aggregate.played ? aggregate.home : null}
        isWinner={Boolean(winner) && winner === tie.homeId}
      />
      <TeamLine
        name={tie.awayId ? nameOf(tie.awayId) : t('tournament.tbd')}
        goals={aggregate.played ? aggregate.away : null}
        isWinner={Boolean(winner) && winner === tie.awayId}
      />

      {bye && (
        <p className="mt-2 text-center text-xs text-silver/50">
          {t('tournament.bye')}
        </p>
      )}

      {legs.map((fixture) => (
        <div
          key={fixture.id}
          className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2"
        >
          <span className="text-xs text-silver/50">
            {legs.length > 1
              ? t('tournament.leg', { number: fixture.leg })
              : t('tournament.score')}
          </span>
          <div className="flex items-center gap-1">
            <ScoreInput
              value={fixture.homeGoals}
              label={t('tournament.homeGoals', {
                team: nameOf(fixture.homeId),
              })}
              onChange={(goals) =>
                onScore(fixture.id, goals, fixture.awayGoals)
              }
            />
            <span className="text-silver/40">:</span>
            <ScoreInput
              value={fixture.awayGoals}
              label={t('tournament.awayGoals', {
                team: nameOf(fixture.awayId),
              })}
              onChange={(goals) =>
                onScore(fixture.id, fixture.homeGoals, goals)
              }
            />
          </div>
        </div>
      ))}

      {legs.length > 1 && aggregate.played && (
        <p className="mt-2 text-center text-xs text-silver/60">
          {t('tournament.aggregate', {
            home: aggregate.home,
            away: aggregate.away,
          })}
        </p>
      )}

      {level && (
        <div className="mt-2 border-t border-white/10 pt-2">
          <p className="mb-1 text-center text-xs text-gold">
            {t('tournament.penaltyQuestion')}
          </p>
          <div className="flex gap-1">
            {[tie.homeId, tie.awayId].map((participantId) => (
              <button
                key={participantId}
                type="button"
                onClick={() =>
                  onShootout(
                    tie.id,
                    state.shootoutWinners[tie.id] === participantId
                      ? null
                      : participantId,
                  )
                }
                className={`flex-1 truncate rounded-lg border px-2 py-1 text-xs transition ${
                  state.shootoutWinners[tie.id] === participantId
                    ? 'border-gold/60 bg-gold/20 text-white'
                    : 'border-white/20 bg-white/5 text-silver/80 hover:border-gold/50'
                }`}
              >
                {nameOf(participantId!)}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

interface TeamLineProps {
  name: string;
  goals: number | null;
  isWinner: boolean;
}

function TeamLine({ name, goals, isWinner }: TeamLineProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span
        className={`truncate text-sm ${
          isWinner ? 'font-bold text-white' : 'text-silver/75'
        }`}
      >
        {name}
      </span>
      <span
        className={`font-display text-sm font-bold ${
          isWinner ? 'text-gold' : 'text-silver/50'
        }`}
      >
        {goals ?? '–'}
      </span>
    </div>
  );
}
