import type { StandingsRow } from '@dreamdraft/shared';
import { useTranslation } from 'react-i18next';

interface StandingsTableProps {
  rows: StandingsRow[];
  nameOf: (participantId: string) => string;
  /** How many top rows go through to the knockout phase (0 = plain league). */
  qualifiers?: number;
}

const NUMERIC_COLUMNS = [
  'played',
  'won',
  'drawn',
  'lost',
  'goalsFor',
  'goalsAgainst',
  'goalDiff',
] as const;

export function StandingsTable({
  rows,
  nameOf,
  qualifiers = 0,
}: StandingsTableProps) {
  const { t } = useTranslation();

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="text-xs tracking-wide text-silver/60 uppercase">
          <th className="w-8 py-2 text-left font-medium">
            {t('tournament.position')}
          </th>
          <th className="py-2 text-left font-medium">{t('tournament.team')}</th>
          {NUMERIC_COLUMNS.map((column) => (
            <th
              key={column}
              className="w-7 py-2 text-center font-medium"
              title={t(`tournament.full.${column}`)}
            >
              {t(`tournament.short.${column}`)}
            </th>
          ))}
          <th
            className="w-9 py-2 text-center font-medium text-gold"
            title={t('tournament.full.points')}
          >
            {t('tournament.short.points')}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => {
          const qualifying = index < qualifiers;
          return (
            <tr
              key={row.participantId}
              className={`border-t border-white/10 ${
                qualifying ? 'bg-star/8' : ''
              }`}
            >
              <td className="py-2 pr-1">
                <span
                  className={`flex size-6 items-center justify-center rounded-md font-display text-xs font-bold ${
                    qualifying
                      ? 'bg-star/25 text-white'
                      : 'bg-white/8 text-silver/70'
                  }`}
                >
                  {index + 1}
                </span>
              </td>
              <td className="max-w-0 truncate py-2 pr-2 text-white">
                {nameOf(row.participantId)}
              </td>
              {NUMERIC_COLUMNS.map((column) => (
                <td
                  key={column}
                  className="py-2 text-center text-xs text-silver/80"
                >
                  {column === 'goalDiff' && row.goalDiff > 0
                    ? `+${row.goalDiff}`
                    : row[column]}
                </td>
              ))}
              <td className="py-2 text-center font-display font-bold text-gold">
                {row.points}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
