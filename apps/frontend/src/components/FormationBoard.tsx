import {
  FORMATION_NAMES,
  TACTICS,
  fillShape,
  type Player,
} from '@dreamdraft/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormationChoice } from './formation';
import { Pitch } from './Pitch';

interface FormationBoardProps {
  name: string;
  squad: Player[];
  choice: FormationChoice;
  onChange: (choice: FormationChoice) => void;
  /** Omitted when the board is shown inline rather than as an overlay. */
  onClose?: () => void;
}

/**
 * Pitch, shape picker and squad list. Clicking a slot arms it, clicking a
 * player then puts that player in it — a pinned slot stays put when the shape
 * or the tactic changes.
 */
export function FormationBoard({
  name,
  squad,
  choice,
  onChange,
  onClose,
}: FormationBoardProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);

  const { slots, bench } = useMemo(
    () => fillShape(squad, choice.formation, choice.pinned),
    [squad, choice.formation, choice.pinned],
  );

  const placed = new Set(
    slots
      .filter((player): player is Player => player !== null)
      .map((p) => p.id),
  );

  const place = (player: Player) => {
    if (selected === null) return;
    const pinned = { ...choice.pinned };
    // A player can only stand in one place, so free whatever slot held them.
    for (const [slot, id] of Object.entries(pinned)) {
      if (id === player.id) delete pinned[Number(slot)];
    }
    pinned[selected] = player.id;
    onChange({ ...choice, pinned });
    setSelected(null);
  };

  const clearSlot = (index: number) => {
    const pinned = { ...choice.pinned };
    delete pinned[index];
    onChange({ ...choice, pinned });
    setSelected(null);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <Pitch
          formation={choice.formation}
          tactic={choice.tactic}
          slots={slots}
          selected={selected}
          onSelectSlot={(index) =>
            setSelected((current) => (current === index ? null : index))
          }
        />
        {selected !== null && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold">
            <span>{t('pitch.pickPlayer')}</span>
            <button
              type="button"
              onClick={() => clearSlot(selected)}
              className="font-display font-bold tracking-wide uppercase underline-offset-2 hover:underline"
            >
              {t('pitch.clearSlot')}
            </button>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate font-display text-xl font-extrabold tracking-wide text-white uppercase">
            {name}
          </h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="shrink-0 rounded-lg border border-white/20 px-2.5 py-1 text-sm text-silver/80 transition hover:border-star/60 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        <Field label={t('pitch.formation')}>
          <div className="flex flex-wrap gap-2">
            {FORMATION_NAMES.map((formation) => (
              <Chip
                key={formation}
                active={choice.formation === formation}
                onClick={() => {
                  onChange({ ...choice, formation, pinned: {} });
                  setSelected(null);
                }}
              >
                {formation}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label={t('pitch.tactic')}>
          <div className="flex flex-wrap gap-2">
            {TACTICS.map((tactic) => (
              <Chip
                key={tactic}
                active={choice.tactic === tactic}
                onClick={() => onChange({ ...choice, tactic })}
              >
                {t(`pitch.tactics.${tactic}`)}
              </Chip>
            ))}
          </div>
        </Field>

        <Field
          label={t('pitch.squad', {
            placed: placed.size,
            total: squad.length,
          })}
        >
          {squad.length === 0 ? (
            <p className="py-6 text-center text-sm text-silver/60">
              {t('pitch.empty')}
            </p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto pr-1">
              {squad.map((player) => (
                <li key={player.id}>
                  <SquadRow
                    player={player}
                    onPlace={() => place(player)}
                    armed={selected !== null}
                    placed={placed.has(player.id)}
                    benched={bench.some((p) => p.id === player.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Field>
      </div>
    </div>
  );
}

function SquadRow({
  player,
  onPlace,
  armed,
  placed,
  benched,
}: {
  player: Player;
  onPlace: () => void;
  armed: boolean;
  placed: boolean;
  benched: boolean;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onPlace}
      disabled={!armed}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
        armed
          ? 'cursor-pointer bg-white/10 hover:bg-gold/20'
          : 'cursor-default bg-white/6'
      } ${benched ? 'opacity-60' : ''}`}
    >
      <span className="w-8 shrink-0 text-center font-display font-bold text-gold">
        {player.rating}
      </span>
      <span className="w-10 shrink-0 text-xs font-semibold text-star">
        {t(`positions.short.${player.position}`)}
      </span>
      <span lang="en" className="flex-1 truncate text-left text-silver">
        {player.name}
      </span>
      {placed ? (
        <span className="shrink-0 text-[0.65rem] tracking-wide text-star/80 uppercase">
          {t('pitch.onPitch')}
        </span>
      ) : (
        <span className="shrink-0 text-[0.65rem] tracking-wide text-silver/50 uppercase">
          {t('pitch.onBench')}
        </span>
      )}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 font-display text-xs font-bold tracking-widest text-silver/70 uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg border px-3 py-1.5 font-display text-sm font-bold tracking-wide transition ${
        active
          ? 'border-star bg-star text-night-950 shadow-[0_0_18px] shadow-star/30'
          : 'border-white/20 bg-white/8 text-silver hover:border-star/60 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * The overlay wrapper: covers the board and closes on an outside click or Esc,
 * which is what "stays until you click elsewhere" means in practice.
 */
export function FormationOverlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-night-950/80 p-4 backdrop-blur-sm sm:p-8"
      onMouseDown={(event) => {
        if (!panel.current?.contains(event.target as Node)) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-5xl rounded-2xl border border-star/40 bg-night-900/95 p-5 shadow-[0_0_60px] shadow-star/20"
      >
        {children}
      </div>
    </div>
  );
}
