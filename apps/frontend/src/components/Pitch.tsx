import { shapeFor, type Player, type Tactic } from '@dreamdraft/shared';
import { useTranslation } from 'react-i18next';

interface PitchProps {
  formation: string;
  tactic: Tactic;
  /** Slot index -> the player standing there, or null for an empty slot. */
  slots: (Player | null)[];
  /** Highlighted slot waiting for a player to be clicked. */
  selected: number | null;
  onSelectSlot: (index: number) => void;
}

/**
 * The squad on a pitch, in the site's own night-and-stars palette rather than
 * the usual green — this sits inside the UCL-styled board, not next to it.
 */
export function Pitch({
  formation,
  tactic,
  slots,
  selected,
  onSelectSlot,
}: PitchProps) {
  const { t } = useTranslation();
  const shape = shapeFor(formation, tactic);

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-star/30 bg-linear-to-b from-night-800 via-night-900 to-night-950 shadow-[0_0_40px] shadow-star/10">
      <PitchMarkings />

      {shape.map((slot, index) => {
        const player = slots[index] ?? null;
        const isSelected = selected === index;
        const outOfPosition =
          player !== null && player.position !== slot.position;

        return (
          <button
            key={`${slot.position}-${index}`}
            type="button"
            onClick={() => onSelectSlot(index)}
            aria-label={t('pitch.slot', {
              position: t(`positions.short.${slot.position}`),
            })}
            aria-pressed={isSelected}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 transition duration-300"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            <span
              className={`flex size-13 items-center justify-center rounded-full border-2 font-display text-xs font-bold tracking-wide transition ${
                isSelected
                  ? 'scale-110 border-gold bg-gold/25 text-gold shadow-[0_0_22px] shadow-gold/40'
                  : player
                    ? outOfPosition
                      ? 'border-magenta/70 bg-magenta/20 text-white'
                      : 'border-star/70 bg-star/20 text-white shadow-[0_0_16px] shadow-star/20'
                    : 'border-dashed border-silver/40 bg-white/5 text-silver/60'
              }`}
            >
              {player ? player.rating : t(`positions.short.${slot.position}`)}
            </span>
            <span
              className={`max-w-26 truncate rounded px-1 text-[0.65rem] leading-tight font-semibold ${
                player ? 'text-white' : 'text-silver/50'
              }`}
              lang={player ? 'en' : undefined}
            >
              {player
                ? lastName(player.name)
                : t(`positions.short.${slot.position}`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Surnames only — a full name never fits under a 52px marker. */
function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1]! : name;
}

/** Halfway line, circle and both boxes, drawn faintly so names stay readable. */
function PitchMarkings() {
  return (
    <svg
      viewBox="0 0 100 133"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="absolute inset-0 size-full text-star/15"
    >
      <rect
        x="3"
        y="3"
        width="94"
        height="127"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      <line
        x1="3"
        y1="66.5"
        x2="97"
        y2="66.5"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      <circle
        cx="50"
        cy="66.5"
        r="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      {/* Own box (bottom) and the one being attacked (top). */}
      <rect
        x="28"
        y="112"
        width="44"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      <rect
        x="28"
        y="3"
        width="44"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.5"
      />
    </svg>
  );
}
