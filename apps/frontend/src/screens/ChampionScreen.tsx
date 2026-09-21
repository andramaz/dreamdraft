import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CelebrationStage } from '../celebration/CelebrationStage';
import { Button } from '../components/Button';

interface ChampionScreenProps {
  winner: string;
  /** Translated format name, e.g. "Champions League". */
  competition: string;
  onSquads: () => void;
  onRestart: () => void;
  /** The recap of every match; omitted when there was no tournament. */
  summary?: React.ReactNode;
}

/** The site's accent, so the celebration lights up in the same blue. */
const ACCENT = '#4cc9ff';

export function ChampionScreen({
  winner,
  competition,
  onSquads,
  onRestart,
  summary,
}: ChampionScreenProps) {
  const { t, i18n } = useTranslation();
  const [showSummary, setShowSummary] = useState(false);
  const top = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  // The recap opens below the trophy, which is a screen tall — so take the
  // reader there, and bring them back to the celebration when they fold it up.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const target = showSummary ? panel.current : top.current;
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showSummary]);
  // Turkish needs its own casing (i -> İ), which the locale-aware form gives us.
  const upper = (value: string) => value.toLocaleUpperCase(i18n.language);

  return (
    <section ref={top} className="flex flex-col gap-6 scroll-mt-4">
      <CelebrationStage
        winner={upper(winner)}
        label={upper(t('champion.title'))}
        subtitle={upper(competition)}
        accent={ACCENT}
      />

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onSquads}>{t('champion.squads')}</Button>
        {summary && (
          <Button
            variant="ghost"
            onClick={() => setShowSummary((open) => !open)}
            aria-expanded={showSummary}
          >
            {showSummary ? t('champion.hideSummary') : t('champion.summary')}
          </Button>
        )}
        <Button variant="ghost" onClick={onRestart}>
          {t('champion.again')}
        </Button>
      </div>

      {summary && showSummary && (
        <div ref={panel} className="scroll-mt-4">
          {summary}
        </div>
      )}
    </section>
  );
}
