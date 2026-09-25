import { STAT_KEYS, statLabel, type Player } from '@dreamdraft/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * The portrait box. The photo and the stand-in for a missing one are the same
 * size because they are the same hole in the card — change it here only.
 */
const PHOTO_SIZE = 'size-24';

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

        <PlayerPhoto player={player} />
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
        {STAT_KEYS.map((key) => {
          // A keeper's six are the keeper card — diving, handling, kicking,
          // reflexes, speed, positioning — sitting in the outfield fields EA
          // returns them in. Same values, same order, different names.
          const label = statLabel(player.position, key);
          return (
            <div
              key={key}
              className="flex items-baseline justify-between"
              title={t(`stats.long.${label}`)}
            >
              <dt className="text-xs font-semibold text-silver/70">
                {t(`stats.short.${label}`)}
              </dt>
              <dd className="font-display font-bold text-white">
                {player[key] ?? '–'}
              </dd>
            </div>
          );
        })}
      </dl>
    </Tag>
  );
}

/**
 * EA fills `photoUrl` in for everyone but has no head render below roughly 65,
 * which is some 7,000 of the pool. The request simply 404s, so the load failing
 * is the only sign there is no portrait — hence the fallback on `onError`
 * rather than on a null url. The failed url is what is remembered, so a card
 * reused for another player tries that player's photo again.
 */
function PlayerPhoto({ player }: { player: Player }) {
  const [broken, setBroken] = useState<string | null>(null);
  const url = player.photoUrl;

  if (!url || broken === url) return <SilhouettePlaceholder />;

  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setBroken(url)}
      className={`${PHOTO_SIZE} object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.6)]`}
    />
  );
}

/**
 * Stands in for a missing portrait: the card's own gold on a well of its own
 * night blue, so an empty frame reads as part of the card rather than as
 * something that failed to load.
 */
function SilhouettePlaceholder() {
  return (
    <span
      aria-hidden="true"
      className={`${PHOTO_SIZE} flex items-center justify-center rounded-full bg-night-950/35 ring-1 ring-gold/25 ring-inset`}
    >
      <svg viewBox="0 0 64 64" className="h-3/5 w-3/5 text-gold/60">
        <circle cx="32" cy="23" r="11" fill="currentColor" />
        <path
          d="M10 58c0-11.6 9.8-20 22-20s22 8.4 22 20z"
          fill="currentColor"
        />
      </svg>
    </span>
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
