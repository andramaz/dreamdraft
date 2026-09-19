import type { Fixture } from '@dreamdraft/shared';
import { useTranslation } from 'react-i18next';
import { ScoreInput } from './ScoreInput';

interface FixtureRowProps {
  fixture: Fixture;
  nameOf: (participantId: string) => string;
  onScore: (home: number | null, away: number | null) => void;
  /** Shown for the second leg of a two-legged tie. */
  legLabel?: string;
}

/** One match line: home — score boxes — away. */
export function FixtureRow({
  fixture,
  nameOf,
  onScore,
  legLabel,
}: FixtureRowProps) {
  const { t } = useTranslation();
  const played = fixture.homeGoals !== null && fixture.awayGoals !== null;
  const homeWon = played && fixture.homeGoals! > fixture.awayGoals!;
  const awayWon = played && fixture.awayGoals! > fixture.homeGoals!;

  return (
    <li className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 sm:gap-3">
      <span
        className={`flex-1 truncate text-right text-sm sm:text-base ${
          homeWon ? 'font-bold text-white' : 'text-silver/80'
        }`}
      >
        {nameOf(fixture.homeId)}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <ScoreInput
          value={fixture.homeGoals}
          label={t('tournament.homeGoals', { team: nameOf(fixture.homeId) })}
          onChange={(goals) => onScore(goals, fixture.awayGoals)}
        />
        <span className="text-silver/40">:</span>
        <ScoreInput
          value={fixture.awayGoals}
          label={t('tournament.awayGoals', { team: nameOf(fixture.awayId) })}
          onChange={(goals) => onScore(fixture.homeGoals, goals)}
        />
      </div>

      <span
        className={`flex-1 truncate text-sm sm:text-base ${
          awayWon ? 'font-bold text-white' : 'text-silver/80'
        }`}
      >
        {nameOf(fixture.awayId)}
      </span>

      {legLabel && (
        <span className="hidden shrink-0 text-xs text-silver/50 sm:inline">
          {legLabel}
        </span>
      )}
    </li>
  );
}
