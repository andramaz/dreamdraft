import { useTranslation } from 'react-i18next';

/**
 * "Final", "Semi-finals", … counted back from the last round, so a bracket of
 * any size names itself. Lives outside the components that use it: both the
 * live bracket and the end-of-tournament recap need it.
 */
export function useRoundLabel() {
  const { t } = useTranslation();
  return (round: number, lastRound: number) => {
    const left = lastRound - round;
    if (left === 0) return t('tournament.rounds.final');
    if (left === 1) return t('tournament.rounds.semi');
    if (left === 2) return t('tournament.rounds.quarter');
    return t('tournament.rounds.roundOf', { teams: 2 ** (left + 1) });
  };
}
