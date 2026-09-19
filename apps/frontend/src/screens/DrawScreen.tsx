import { createRng, randomSeed, type Participant } from '@dreamdraft/shared';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { Wheel } from '../components/Wheel';

const SPIN_MS = 3200;

interface DrawScreenProps {
  participants: Participant[];
  /** Called with the drawn pick order (participant ids). */
  onDone: (order: string[]) => void;
}

/**
 * Draws the pick order slot by slot: spin, the pointer lands on someone,
 * they take the next slot and leave the wheel.
 */
export function DrawScreen({ participants, onDone }: DrawScreenProps) {
  const { t } = useTranslation();
  const rngRef = useRef(createRng(randomSeed()));
  const [remaining, setRemaining] = useState<Participant[]>(participants);
  const [drawn, setDrawn] = useState<Participant[]>([]);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const commit = (winner: Participant) => {
    setDrawn((current) => [...current, winner]);
    setRemaining((current) => current.filter((p) => p.id !== winner.id));
    setSpinning(false);
  };

  const spin = () => {
    if (spinning || remaining.length === 0) return;
    const index = Math.floor(rngRef.current() * remaining.length);
    const winner = remaining[index]!;

    if (reducedMotion) {
      commit(winner);
      return;
    }

    // Land the pointer (fixed at the top) on the middle of the winner segment.
    const segment = 360 / remaining.length;
    const target = -(index * segment + segment / 2);
    const delta = (((target - (rotation % 360)) % 360) + 360) % 360;
    setRotation(rotation + 360 * 4 + delta);
    setSpinning(true);
    window.setTimeout(() => commit(winner), SPIN_MS);
  };

  const finished = remaining.length === 0;

  return (
    <section className="flex flex-col items-center gap-6">
      <header className="text-center">
        <h2 className="font-display text-2xl font-bold tracking-wide text-white uppercase">
          {t('draw.title')}
        </h2>
        {!finished && (
          <p className="mt-1 text-sm text-silver/70">
            {t('draw.subtitle', {
              current: drawn.length + 1,
              total: participants.length,
            })}
          </p>
        )}
      </header>

      <div className="grid w-full items-center gap-8 md:grid-cols-2">
        <div>
          {finished ? (
            <div className="flex h-full items-center justify-center">
              <span className="font-display text-6xl">🏆</span>
            </div>
          ) : (
            <Wheel
              entries={remaining}
              rotation={rotation}
              durationMs={spinning && !reducedMotion ? SPIN_MS : 0}
            />
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="font-display text-sm font-bold tracking-wide text-silver/80 uppercase">
            {t('draw.result')}
          </h3>
          <ol className="flex flex-col gap-2">
            {participants.map((_, index) => {
              const winner = drawn[index];
              return (
                <li
                  key={index}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition ${
                    winner
                      ? 'border-star/50 bg-star/10 text-white'
                      : 'border-white/15 bg-white/6 text-silver/40'
                  }`}
                >
                  <span className="font-display text-lg font-extrabold text-star">
                    {index + 1}
                  </span>
                  <span className="font-display font-bold">
                    {winner?.name ?? '—'}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {finished ? (
          <Button onClick={() => onDone(drawn.map((p) => p.id))}>
            {t('draw.continue')}
          </Button>
        ) : (
          <Button onClick={spin} disabled={spinning}>
            {spinning ? t('draw.spinning') : t('draw.spin')}
          </Button>
        )}
      </div>
    </section>
  );
}
