import { STAT_KEYS, type Player } from '@dreamdraft/shared';
import { useTranslation } from 'react-i18next';

interface PlayerCardProps {
  player: Player;
  onPick?: (player: Player) => void;
  /**
   * Shown but not pickable — the club limit is full. It stays on the board on
   * purpose, so the picker sees why rather than watching players disappear.
   */
  blocked?: boolean;
}

export function PlayerCard({
  player,
  onPick,
  blocked = false,
}: PlayerCardProps) {
  const { t } = useTranslation();
  const interactive = onPick !== undefined;

  const Tag = interactive ? 'button' : 'article';

  return (
    <Tag
      {...(interactive
        ? {
            type: 'button' as const,
            onClick: () => onPick(player),
            'aria-disabled': blocked || undefined,
          }
        : {})}
      className={`shine group flex w-full flex-col rounded-2xl border bg-linear-to-b from-[#3d5cd6] via-[#22317f] to-night-900 p-4 text-left shadow-lg shadow-night-950/50 transition duration-300 ${
        blocked
          ? 'cursor-not-allowed border-white/15 opacity-40 saturate-50'
          : interactive
            ? 'cursor-pointer border-gold/50 hover:-translate-y-1 hover:border-gold hover:shadow-[0_0_28px] hover:shadow-gold/40 focus-visible:-translate-y-1 focus-visible:border-gold'
            : 'border-gold/50 hover:-translate-y-1 hover:border-gold hover:shadow-[0_0_28px] hover:shadow-gold/30'
      }`}
    >
      <header className="flex items-start justify-between">
        <div className="flex flex-col items-center leading-none text-gold">
          <span
            className="font-display text-4xl font-extrabold"
            aria-label={t('players.rating')}
          >
            {player.rating}
          </span>
          <span
            className="mt-1 font-display text-sm font-bold"
            title={t(`positions.long.${player.position}`)}
          >
            {t(`positions.short.${player.position}`)}
          </span>
        </div>

        {player.photoUrl ? (
          <img
            src={player.photoUrl}
            alt=""
            loading="lazy"
            className="size-24 object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.6)]"
          />
        ) : (
          <SilhouettePlaceholder />
        )}
      </header>

      {/* lang="en": player names are proper nouns — avoid Turkish i→İ uppercasing */}
      <h3
        lang="en"
        className="mt-3 truncate text-center font-display text-lg font-bold tracking-wide text-white uppercase"
      >
        {player.name}
      </h3>
      <p className="truncate text-center text-xs text-silver/70">
        {player.club}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-gold/20 pt-3 text-sm">
        {STAT_KEYS.map((key) => (
          <div
            key={key}
            className="flex items-baseline justify-between"
            title={t(`stats.long.${key}`)}
          >
            <dt className="text-xs font-semibold text-silver/70">
              {t(`stats.short.${key}`)}
            </dt>
            <dd className="font-display font-bold text-white">
              {player[key] ?? '–'}
            </dd>
          </div>
        ))}
      </dl>
    </Tag>
  );
}

function SilhouettePlaceholder() {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="size-24 text-gold/25"
    >
      <circle cx="32" cy="22" r="12" fill="currentColor" />
      <path d="M8 62c0-14 10.7-24 24-24s24 10 24 24z" fill="currentColor" />
    </svg>
  );
}

/** Compact row used in squad lists. */
export function PlayerRow({ player }: { player: Player }) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center gap-2 rounded-lg bg-white/10 px-2 py-1.5 text-sm">
      <span className="w-8 shrink-0 text-center font-display font-bold text-gold">
        {player.rating}
      </span>
      <span className="w-10 shrink-0 text-xs font-semibold text-star">
        {t(`positions.short.${player.position}`)}
      </span>
      <span lang="en" className="flex-1 truncate text-silver">
        {player.name}
      </span>
      <span className="hidden max-w-28 truncate text-xs text-silver/60 sm:block">
        {player.club}
      </span>
    </li>
  );
}
