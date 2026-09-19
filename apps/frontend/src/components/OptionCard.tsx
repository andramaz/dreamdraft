import type { ReactNode } from 'react';

interface OptionCardProps {
  title: string;
  description?: string;
  selected: boolean;
  disabled?: boolean;
  badge?: ReactNode;
  onSelect: () => void;
}

/** Big selectable tile used throughout the config wizard. */
export function OptionCard({
  title,
  description,
  selected,
  disabled = false,
  badge,
  onSelect,
}: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`shine group flex h-full flex-col rounded-2xl border p-5 text-left transition duration-300 disabled:cursor-not-allowed disabled:opacity-40 ${
        selected
          ? 'border-star bg-linear-to-br from-star/30 via-night-700/70 to-magenta/25 shadow-[0_0_30px] shadow-star/30'
          : 'border-white/15 bg-white/8 hover:border-star/50 hover:bg-white/12'
      }`}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="font-display text-lg font-bold tracking-wide text-white uppercase">
          {title}
        </span>
        {badge}
      </span>
      {description && (
        <span className="mt-2 text-sm text-silver/70">{description}</span>
      )}
    </button>
  );
}
