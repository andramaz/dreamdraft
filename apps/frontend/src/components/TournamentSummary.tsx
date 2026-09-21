import {
  knockoutRounds,
  leagueFixtures,
  leagueRounds,
  standings,
  tieAggregate,
  type Fixture,
  type KnockoutTie,
  type TournamentState,
} from '@dreamdraft/shared';
import { useTranslation } from 'react-i18next';
import { StandingsTable } from './StandingsTable';
import { useRoundLabel } from './roundLabel';

interface TournamentSummaryProps {
  state: TournamentState;
  nameOf: (participantId: string) => string;
}

/**
 * Everything that happened, read only. The live screen disappears behind the
 * champion celebration, so this is the only way back to the scores — and it is
 * deliberately not editable: the tournament is over.
 */
export function TournamentSummary({ state, nameOf }: TournamentSummaryProps) {
  const { t } = useTranslation();
  const roundLabel = useRoundLabel();

  const league = leagueFixtures(state);
  const leagueWeeks = Array.from(
    { length: leagueRounds(state) },
    (_, index) => index + 1,
  );
  const lastRound = knockoutRounds(state);
  const knockoutRoundNumbers = Array.from(
    { length: lastRound },
    (_, index) => index + 1,
  );

  return (
    <div className="flex flex-col gap-6 text-left">
      {league.length > 0 && (
        <section className="flex flex-col gap-3">
          <Heading>
            {state.format === 'ucl'
              ? t('tournament.finalTable')
              : t('tournament.standings')}
          </Heading>
          <div className="panel px-4 py-3">
            <StandingsTable
              rows={standings(state)}
              nameOf={nameOf}
              qualifiers={state.format === 'ucl' ? state.qualifiers : 0}
            />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <Heading>{t('tournament.allMatches')}</Heading>

        <div className="grid gap-3 sm:grid-cols-2">
          {leagueWeeks.map((week) => (
            <Group
              key={`week-${week}`}
              title={t('tournament.week', { number: week })}
            >
              {league
                .filter((fixture) => fixture.round === week)
                .map((fixture) => (
                  <ResultLine
                    key={fixture.id}
                    fixture={fixture}
                    nameOf={nameOf}
                  />
                ))}
            </Group>
          ))}

          {knockoutRoundNumbers.map((round) => {
            const ties = state.ties
              .filter((tie) => tie.round === round)
              .sort((a, b) => a.slot - b.slot);
            if (ties.length === 0) return null;
            return (
              <Group
                key={`round-${round}`}
                title={roundLabel(round, lastRound)}
              >
                {ties.map((tie) => (
                  <TieSummary
                    key={tie.id}
                    tie={tie}
                    state={state}
                    nameOf={nameOf}
                  />
                ))}
              </Group>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-sm font-bold tracking-widest text-star uppercase">
      {children}
    </h3>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="panel px-4 py-3">
      <h4 className="mb-2 font-display text-xs font-bold tracking-widest text-silver/70 uppercase">
        {title}
      </h4>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </article>
  );
}

/** One played match: home — score — away, the winner picked out in white. */
function ResultLine({
  fixture,
  nameOf,
  label,
}: {
  fixture: Fixture;
  nameOf: (participantId: string) => string;
  label?: string;
}) {
  const { t } = useTranslation();
  const played = fixture.homeGoals !== null && fixture.awayGoals !== null;
  const homeWon = played && fixture.homeGoals! > fixture.awayGoals!;
  const awayWon = played && fixture.awayGoals! > fixture.homeGoals!;

  return (
    <li className="flex items-center gap-2 text-sm">
      {label && (
        <span className="w-12 shrink-0 text-[0.65rem] tracking-wide text-silver/40 uppercase">
          {label}
        </span>
      )}
      <span
        className={`flex-1 truncate text-right ${
          homeWon ? 'font-bold text-white' : 'text-silver/75'
        }`}
      >
        {nameOf(fixture.homeId)}
      </span>
      <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 font-display text-sm font-bold text-gold tabular-nums">
        {played
          ? `${fixture.homeGoals}–${fixture.awayGoals}`
          : t('tournament.tbd')}
      </span>
      <span
        className={`flex-1 truncate ${
          awayWon ? 'font-bold text-white' : 'text-silver/75'
        }`}
      >
        {nameOf(fixture.awayId)}
      </span>
    </li>
  );
}

/** A knockout pairing: every leg, the aggregate, and who won the shootout. */
function TieSummary({
  tie,
  state,
  nameOf,
}: {
  tie: KnockoutTie;
  state: TournamentState;
  nameOf: (participantId: string) => string;
}) {
  const { t } = useTranslation();
  const legs = state.fixtures
    .filter((fixture) => fixture.tieId === tie.id)
    .sort((a, b) => a.leg - b.leg);
  // Only the first round hands out a bye; later on an empty slot is a tie still
  // waiting for the other half of the bracket.
  const bye = tie.round === 1 && Boolean(tie.homeId) && !tie.awayId;

  if (bye) {
    return (
      <li className="flex items-center gap-2 text-sm">
        <span className="flex-1 truncate text-right font-bold text-white">
          {tie.homeId ? nameOf(tie.homeId) : t('tournament.tbd')}
        </span>
        <span className="shrink-0 text-xs text-silver/50">
          {t('tournament.bye')}
        </span>
        <span className="flex-1" />
      </li>
    );
  }

  const aggregate = tieAggregate(state, tie);
  const shootout = state.shootoutWinners[tie.id];

  return (
    <li className="flex flex-col gap-1 border-b border-white/10 pb-1.5 last:border-b-0 last:pb-0">
      {legs.map((fixture) => (
        <ResultLine
          key={fixture.id}
          fixture={fixture}
          nameOf={nameOf}
          label={
            legs.length > 1
              ? t('tournament.leg', { number: fixture.leg })
              : undefined
          }
        />
      ))}

      {legs.length > 1 && aggregate.played && (
        <p className="text-center text-xs text-silver/50">
          {t('tournament.aggregate', {
            home: aggregate.home,
            away: aggregate.away,
          })}
        </p>
      )}

      {shootout && (
        <p className="text-center text-xs text-gold">
          {t('tournament.penaltyWinner', { name: nameOf(shootout) })}
        </p>
      )}
    </li>
  );
}
