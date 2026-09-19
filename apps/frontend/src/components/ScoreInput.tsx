interface ScoreInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
  disabled?: boolean;
}

/** One goal box. Empty means "not played yet", not 0. */
export function ScoreInput({
  value,
  onChange,
  label,
  disabled = false,
}: ScoreInputProps) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={99}
      aria-label={label}
      disabled={disabled}
      value={value ?? ''}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw === '') {
          onChange(null);
          return;
        }
        const goals = Number.parseInt(raw, 10);
        if (Number.isNaN(goals)) return;
        onChange(Math.min(99, Math.max(0, goals)));
      }}
      className="h-9 w-11 rounded-lg border border-white/20 bg-night-950/60 text-center font-display text-lg font-bold text-white transition [appearance:textfield] focus:border-star focus:outline-none focus:ring-2 focus:ring-star/40 disabled:opacity-40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}
