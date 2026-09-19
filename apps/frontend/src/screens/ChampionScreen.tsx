import { useTranslation } from 'react-i18next';
import { CelebrationStage } from '../celebration/CelebrationStage';
import { Button } from '../components/Button';

interface ChampionScreenProps {
  winner: string;
  /** Translated format name, e.g. "Champions League". */
  competition: string;
  onSquads: () => void;
  onRestart: () => void;
}

/** The site's accent, so the celebration lights up in the same blue. */
const ACCENT = '#4cc9ff';

export function ChampionScreen({
  winner,
  competition,
  onSquads,
  onRestart,
}: ChampionScreenProps) {
  const { t, i18n } = useTranslation();
  // Turkish needs its own casing (i -> İ), which the locale-aware form gives us.
  const upper = (value: string) => value.toLocaleUpperCase(i18n.language);

  return (
    <section className="flex flex-col gap-6">
      <CelebrationStage
        winner={upper(winner)}
        label={upper(t('champion.title'))}
        subtitle={upper(competition)}
        accent={ACCENT}
      />

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onSquads}>{t('champion.squads')}</Button>
        <Button variant="ghost" onClick={onRestart}>
          {t('champion.again')}
        </Button>
      </div>
    </section>
  );
}
