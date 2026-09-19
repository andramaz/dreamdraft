import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'subtle';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-linear-to-r from-star to-[#8fb2ff] text-night-950 shadow-[0_0_22px] shadow-star/50 hover:shadow-star/80 disabled:shadow-none',
  ghost:
    'border border-white/25 bg-white/5 text-silver hover:border-star/70 hover:bg-white/10 hover:text-white',
  subtle: 'text-silver/70 hover:text-white',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-full px-5 py-2 font-display text-sm font-bold tracking-wide uppercase transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    />
  );
}
