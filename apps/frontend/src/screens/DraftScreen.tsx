import {
  POSITIONS,
  availablePlayers,
  clubCounts,
  currentParticipantId,
  currentRound,
  isClubExhausted,
  randomTeamsRules,
  remainingPlayers,
  rerollsLeft,
  squads,
  yourChoiceLimit,
  type DraftState,
  type PickConstraint,
  type Player,
  type Position,
} from '@dreamdraft/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/Button';
import { FormationBoard, FormationOverlay } from '../components/FormationBoard';
import { defaultChoice, type FormationChoice } from '../components/formation';
import { PlayerCard, PlayerRow } from '../components/PlayerCard';

const PAGE_SIZE = 24;

interface DraftScreenProps {
  state: DraftState;
  players: Player[];
  onPick: (playerId: number) => void;
  onRoll: (reroll?: boolean) => void;
  onUndo: () => void;
  canUndo: boolean;
  /** Pitch layouts, shared with the results screen so they survive the draft. */
  formations: Record<string, FormationChoice>;
  onFormationChange: (participantId: string, choice: FormationChoice) => void;
}

export function DraftScreen({
  state,
  players,
  onPick,
  onRoll,
  onUndo,
  canUndo,
  formations,
  onFormationChange,
}: DraftScreenProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState<Position | 'all'>('all');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [openSquad, setOpenSquad] = useState<string | null>(null);

  const pickerId = currentParticipantId(state);
  const picker = state.participants.find((p) => p.id === pickerId);
  const options = useMemo(
    () => availablePlayers(state, players),
    [state, players],
  );

  const isYourChoice = state.config.draftStyle === 'yourChoice';
  const clubLimit = yourChoiceLimit(state.config);
  // Clubs this picker has already used up. Empty unless Your Choice caps them.
  const fullClubs = useMemo(() => {
    if (!isYourChoice || pickerId === undefined) return new Set<string>();
    const counts = clubCounts(state, pickerId, players);
    return new Set(
      [...counts.entries()]
        .filter(([, taken]) => taken >= clubLimit)
        .map(([club]) => club),
    );
  }, [isYourChoice, pickerId, state, players, clubLimit]);

  // Your Choice keeps blocked players on the board and explains the block, so
  // it draws from everything left rather than from the filtered options.
  const board = useMemo(
    () =>
      isYourChoice && fullClubs.size > 0
        ? remainingPlayers(state, players)
        : options,
    [isYourChoice, fullClubs, state, players, options],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return board
      .filter(
        (player) =>
          (positionFilter === 'all' || player.position === positionFilter) &&
          (needle === '' ||
            player.name.toLocaleLowerCase().includes(needle) ||
            player.club.toLocaleLowerCase().includes(needle)),
      )
      .sort((a, b) => b.rating - a.rating);
  }, [board, search, positionFilter]);

  // A warning belongs to the pick that raised it, so the next pick retires it
  // without an effect having to clear anything.
  const [clubWarning, setClubWarning] = useState<{
    index: number;
    text: string;
  } | null>(null);
  const warning =
    clubWarning?.index === state.currentIndex ? clubWarning.text : null;

  const pickable = filtered.filter((player) => !fullClubs.has(player.club));

  const currentSquads = useMemo(() => squads(state, players), [state, players]);
  const isRandomTeams = state.config.draftStyle === 'randomTeams';
  const isRandomPosition = state.config.draftStyle === 'randomPosition';
  // Random Position draws its position and its rating band on screen, one after
  // the other. The answer is known already — the spin is there so the pick
  // feels drawn rather than handed over.
  const reveal = useConstraintReveal(state.currentIndex, isRandomPosition);
  // Random Position and Random Teams already narrow the board down themselves.
  const showFilters =
    state.config.draftStyle !== 'randomPosition' && !isRandomTeams;

  return (
    <section className="flex flex-col gap-6">
      <header className="rounded-2xl border border-star/40 bg-linear-to-r from-night-700/80 via-night-800/70 to-magenta/20 p-5 shadow-[0_0_45px] shadow-star/20">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs tracking-wide text-silver/70 uppercase">
          <span>
            {t('board.round', {
              current: currentRound(state),
              total: state.config.playersPerTeam,
            })}
          </span>
          <span>
            {t('board.pick', {
              current: state.currentIndex + 1,
              total: state.sequence.length,
            })}
          </span>
        </div>

        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-wide text-white uppercase drop-shadow-[0_0_18px_rgba(76,201,255,0.45)]">
          {t('board.turn', { name: picker?.name ?? '' })}
        </h2>
        {/*
          The rule the picker has to follow. It used to be a thin blue line that
          read as decoration against the blue header, so it now sits in a gold
          chip — the site's "pay attention" colour, and warmer than the panel.
        */}
        <div className="mt-3">
          {isRandomPosition ? (
            <ConstraintRoll constraint={state.constraint} reveal={reveal} />
          ) : (
            <span className="inline-block rounded-lg border border-gold/50 bg-gold/15 px-3 py-1.5 font-display text-sm font-bold tracking-wide text-gold shadow-[0_0_18px] shadow-gold/15">
              <Banner state={state} />
            </span>
          )}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          {isRandomTeams && (
            <RandomTeamsBoard state={state} players={players} onRoll={onRoll} />
          )}

          <div className="flex flex-wrap items-center gap-3">
            {showFilters && (
              <>
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setVisible(PAGE_SIZE);
                  }}
                  placeholder={t('board.search')}
                  className="min-w-48 flex-1 rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm text-white outline-none placeholder:text-silver/50 focus:border-star/60"
                />
                <select
                  value={positionFilter}
                  onChange={(event) => {
                    setPositionFilter(event.target.value as Position | 'all');
                    setVisible(PAGE_SIZE);
                  }}
                  aria-label={t('board.filterPosition')}
                  className="rounded-lg border border-white/15 bg-night-800 px-3 py-2 text-sm text-white outline-none focus:border-star/60"
                >
                  <option value="all">{t('board.allPositions')}</option>
                  {POSITIONS.map((position) => (
                    <option key={position} value={position}>
                      {t(`positions.short.${position}`)}
                    </option>
                  ))}
                </select>
              </>
            )}
            {/* The count would give the draw away before it lands. */}
            {reveal.stage === 'done' && (
              <span className="text-xs text-silver/60">
                {t('board.available', { count: pickable.length })}
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={onUndo} disabled={!canUndo}>
                {t('board.undo')}
              </Button>
            </div>
          </div>

          {/* Red, not gold: the gold chip above is the standing rule, this is
              the refusal of something the picker just tried. */}
          {warning && (
            <p
              role="status"
              className="rounded-xl border border-red-400/60 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-200"
            >
              {warning}
            </p>
          )}

          {reveal.stage !== 'done' ? (
            // Holding the board back is the point: if the cards were already
            // there, the draw above would be showing an answer you could read.
            <p className="py-16 text-center font-display tracking-wide text-star/80 uppercase">
              {reveal.stage === 'idle'
                ? t('board.drawPrompt')
                : t('board.drawing')}
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-16 text-center text-silver/70">
              {isRandomTeams && state.randomTeams.club === null
                ? t('board.rollFirst')
                : t('board.noMatch')}
            </p>
          ) : (
            <>
              <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-3">
                {filtered.slice(0, visible).map((player) => {
                  const blocked = fullClubs.has(player.club);
                  return (
                    <li key={player.id}>
                      <PlayerCard
                        player={player}
                        blocked={blocked}
                        onPick={() =>
                          blocked
                            ? setClubWarning({
                                index: state.currentIndex,
                                text: t('board.clubLimitFull', {
                                  club: player.club,
                                  max: clubLimit,
                                }),
                              })
                            : onPick(player.id)
                        }
                      />
                    </li>
                  );
                })}
              </ul>
              {filtered.length > visible && (
                <Button
                  variant="ghost"
                  className="self-center"
                  onClick={() => setVisible((count) => count + PAGE_SIZE)}
                >
                  {t('board.showMore')}
                </Button>
              )}
            </>
          )}
        </div>

        <aside className="flex flex-col gap-3">
          <h3 className="font-display text-sm font-bold tracking-wide text-silver/80 uppercase">
            {t('board.squads')}
          </h3>
          {state.order.map((participantId, index) => {
            const participant = state.participants.find(
              (p) => p.id === participantId,
            )!;
            const squad = currentSquads[participantId] ?? [];
            const isPicking = participantId === pickerId;
            return (
              <button
                key={participantId}
                type="button"
                onClick={() => setOpenSquad(participantId)}
                aria-label={t('pitch.open', { name: participant.name })}
                className={`rounded-xl border p-3 text-left transition ${
                  isPicking
                    ? 'border-star/60 bg-star/10 shadow-[0_0_20px] shadow-star/20'
                    : 'border-white/15 bg-white/6'
                } hover:border-star/70 hover:bg-star/10`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-display font-bold text-white">
                    {index + 1}. {participant.name}
                  </span>
                  <span className="text-xs text-silver/70">
                    {t('board.picksCount', {
                      current: squad.length,
                      total: state.config.playersPerTeam,
                    })}
                  </span>
                </div>
                {squad.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {squad.slice(-3).map((player) => (
                      <PlayerRow key={player.id} player={player} />
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-[0.65rem] tracking-wide text-star/70 uppercase">
                  {t('pitch.openHint')}
                </p>
              </button>
            );
          })}
        </aside>

        {openSquad && (
          <FormationOverlay onClose={() => setOpenSquad(null)}>
            <FormationBoard
              name={
                state.participants.find((p) => p.id === openSquad)?.name ?? ''
              }
              squad={currentSquads[openSquad] ?? []}
              choice={
                formations[openSquad] ??
                defaultChoice(currentSquads[openSquad] ?? [])
              }
              onChange={(choice) => onFormationChange(openSquad, choice)}
              onClose={() => setOpenSquad(null)}
            />
          </FormationOverlay>
        )}
      </div>
    </section>
  );
}

/**
 * Random Teams board: roll a club for this pick, or burn a right to roll
 * again. One player is picked from whatever club is showing.
 */
function RandomTeamsBoard({
  state,
  players,
  onRoll,
}: {
  state: DraftState;
  players: Player[];
  onRoll: (reroll?: boolean) => void;
}) {
  const { t } = useTranslation();
  const rules = randomTeamsRules(state.config);
  const club = state.randomTeams.club;
  const left = rerollsLeft(state);
  const exhausted = club !== null && isClubExhausted(state, players);
  const { rolling, teaser, startRoll } = useRollAnimation(players, onRoll);

  return (
    <section className="panel p-5">
      <h3 className="font-display text-xs font-bold tracking-[0.2em] text-silver/70 uppercase">
        {t('board.draftBoard')}
      </h3>

      <div className="mt-4 flex min-h-36 flex-col items-center justify-center gap-3 text-center">
        {rolling ? (
          <>
            <span
              className="animate-[dice-roll_0.6s_linear_infinite] text-5xl"
              aria-hidden="true"
            >
              🎲
            </span>
            {/* lang="en": club names are proper nouns — no Turkish i→İ uppercasing */}
            <p
              lang="en"
              className="font-display text-2xl font-bold tracking-wide text-silver/60 uppercase blur-[1px]"
            >
              {teaser ?? '—'}
            </p>
            <p className="text-xs tracking-wide text-star uppercase">
              {t('board.rolling')}
            </p>
          </>
        ) : club === null ? (
          <>
            <span className="text-4xl" aria-hidden="true">
              🎲
            </span>
            <p className="text-sm text-silver/70">{t('board.rollHint')}</p>
            <Button onClick={() => startRoll(false)}>
              {t('board.rollTeam')}
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs tracking-wide text-silver/70 uppercase">
              {t('board.yourTeam')}
            </p>
            <span className="relative">
              {/* flash ring on reveal */}
              <span
                key={`flash-${club}`}
                aria-hidden="true"
                className="absolute inset-0 animate-[reveal-flash_0.7s_ease-out_forwards] rounded-full bg-star/30 blur-xl"
              />
              <p
                key={club}
                lang="en"
                className="relative animate-[club-reveal_0.55s_cubic-bezier(0.16,1,0.3,1)] font-display text-3xl font-extrabold tracking-wide text-gold uppercase drop-shadow-[0_0_20px_rgba(247,217,138,0.45)]"
              >
                {club}
              </p>
            </span>
            {exhausted && (
              <p className="rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                {t('board.clubExhausted', { max: rules.maxPlayersPerTeam })}
              </p>
            )}
          </>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-4">
        <span className="font-display text-xs font-bold tracking-[0.2em] text-silver/70 uppercase">
          {t('board.rerollPool')}
        </span>
        <span className="flex items-center gap-2">
          <span className="flex gap-1" aria-hidden="true">
            {Array.from({ length: rules.rerolls }, (_, index) => (
              <span
                key={index}
                className={`size-2 rounded-full ${
                  index < left ? 'bg-gold' : 'bg-white/15'
                }`}
              />
            ))}
          </span>
          <span className="font-display text-sm font-bold text-gold">
            {t('board.rerollsLeft', { left, total: rules.rerolls })}
          </span>
        </span>
      </div>

      <Button
        variant="ghost"
        className="mt-3 w-full"
        onClick={() => startRoll(true)}
        disabled={rolling || club === null || (left === 0 && !exhausted)}
      >
        🔄 {t('board.anotherTeam')}
        {exhausted ? ` (${t('board.freeReroll')})` : ''}
      </Button>
    </section>
  );
}

const ROLL_MS = 1500;
const TEASER_MS = 85;

/**
 * The club is decided the moment the button is pressed — this just holds the
 * result back for a beat while the dice tumbles and club names flick past.
 */
/** How long each of the two Random Position draws spins for. */
const POSITION_ROLL_MS = 1200;
const RATING_ROLL_MS = 1200;

type RevealStage = 'idle' | 'position' | 'rating' | 'done';

interface ConstraintReveal {
  stage: RevealStage;
  /** Advances while spinning, so the chips can flicker through candidates. */
  tick: number;
  /** Starts the two draws. The picker presses it; nothing happens on its own. */
  draw: () => void;
}

/**
 * Runs the two draws for one pick: the position first, then the rating band.
 * Keyed on the pick index, so every turn waits for its own button press.
 */
function useConstraintReveal(
  pickIndex: number,
  active: boolean,
): ConstraintReveal {
  const [progress, setProgress] = useState({
    index: -1,
    stage: 'done' as RevealStage,
  });
  const [tick, setTick] = useState(0);
  const timers = useRef<number[]>([]);

  // Derived, not stored: a pick nobody has drawn for yet is waiting.
  const stage: RevealStage = !active
    ? 'done'
    : progress.index === pickIndex
      ? progress.stage
      : 'idle';

  // Dropping the timers when the pick changes also covers unmount.
  useEffect(
    () => () => {
      timers.current.forEach((id) => {
        window.clearInterval(id);
        window.clearTimeout(id);
      });
      timers.current = [];
    },
    [pickIndex],
  );

  const draw = () => {
    if (stage !== 'idle') return;

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reducedMotion) {
      setProgress({ index: pickIndex, stage: 'done' });
      return;
    }

    setProgress({ index: pickIndex, stage: 'position' });
    const ticker = window.setInterval(
      () => setTick((value) => value + 1),
      TEASER_MS,
    );
    const toRating = window.setTimeout(
      () => setProgress({ index: pickIndex, stage: 'rating' }),
      POSITION_ROLL_MS,
    );
    const finish = window.setTimeout(() => {
      window.clearInterval(ticker);
      setProgress({ index: pickIndex, stage: 'done' });
    }, POSITION_ROLL_MS + RATING_ROLL_MS);
    timers.current = [ticker, toRating, finish];
  };

  return { stage, tick, draw };
}

/** The two draws of a Random Position pick, side by side. */
function ConstraintRoll({
  constraint,
  reveal,
}: {
  constraint: PickConstraint | undefined;
  reveal: ConstraintReveal;
}) {
  const { t } = useTranslation();
  const { stage, tick, draw } = reveal;

  const waiting = stage === 'idle';
  const positionSettled = !waiting && stage !== 'position';
  const ratingSettled = stage === 'done';

  const spinning: Position = POSITIONS[tick % POSITIONS.length]!;
  const settled: Position | undefined = constraint?.position;
  const position: string = waiting
    ? '?'
    : positionSettled
      ? settled
        ? t(`positions.short.${settled}`)
        : '—'
      : t(`positions.short.${spinning}`);

  // A plausible-looking band while it spins, so the numbers are never the
  // answer before the draw lands on it.
  const spinningLow = 60 + ((tick * 7) % 35);
  const rating: string = waiting
    ? '?'
    : ratingSettled
      ? constraint?.minRating !== undefined &&
        constraint.maxRating !== undefined
        ? `${constraint.minRating}-${constraint.maxRating}`
        : t('board.anyRating')
      : `${spinningLow}-${spinningLow + 4}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <RollChip
        label={t('board.rollPosition')}
        value={position}
        spinning={!positionSettled && !waiting}
        pending={waiting}
      />
      <RollChip
        label={t('board.rollRating')}
        value={rating}
        spinning={!ratingSettled && !waiting}
        pending={waiting || !positionSettled}
      />
      {waiting && (
        <Button className="ml-1" onClick={draw}>
          🎲 {t('board.drawConstraint')}
        </Button>
      )}
    </div>
  );
}

function RollChip({
  label,
  value,
  spinning,
  pending = false,
}: {
  label: string;
  value: string;
  spinning: boolean;
  pending?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-baseline gap-2 rounded-lg border px-3 py-1.5 font-display text-sm font-bold tracking-wide transition ${
        spinning
          ? 'border-star/50 bg-star/10 text-star'
          : 'border-gold/50 bg-gold/15 text-gold shadow-[0_0_18px] shadow-gold/15'
      } ${pending ? 'opacity-40' : ''}`}
    >
      <span className="text-[0.7rem] font-semibold tracking-widest opacity-70">
        {label}
      </span>
      <span
        className={`tabular-nums ${spinning ? 'blur-[0.6px]' : ''}`}
        aria-live={spinning ? 'off' : 'polite'}
      >
        {value}
      </span>
    </span>
  );
}

function useRollAnimation(
  players: Player[],
  onRoll: (reroll?: boolean) => void,
) {
  const [rolling, setRolling] = useState(false);
  const [teaser, setTeaser] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const clubs = useMemo(
    () => [...new Set(players.map((player) => player.club))],
    [players],
  );

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearInterval(id));
      timers.current = [];
    },
    [],
  );

  const startRoll = (reroll: boolean) => {
    if (rolling) return;

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (reducedMotion || clubs.length === 0) {
      onRoll(reroll);
      return;
    }

    setRolling(true);
    const ticker = window.setInterval(() => {
      setTeaser(clubs[Math.floor(Math.random() * clubs.length)]!);
    }, TEASER_MS);
    const finish = window.setTimeout(() => {
      window.clearInterval(ticker);
      setTeaser(null);
      setRolling(false);
      onRoll(reroll);
    }, ROLL_MS);

    timers.current.push(ticker, finish);
  };

  return { rolling, teaser, startRoll };
}

/** The style-specific rule the current picker has to follow. */
function Banner({ state }: { state: DraftState }) {
  const { t } = useTranslation();
  const pickerId = currentParticipantId(state);

  switch (state.config.draftStyle) {
    case 'randomTeams':
      return state.randomTeams.club === null
        ? t('board.rollHint')
        : t('board.clubBanner', { club: state.randomTeams.club });
    case 'gambler':
      return t('board.squadBanner', {
        count: pickerId ? (state.assignedSquads[pickerId]?.length ?? 0) : 0,
      });
    // randomPosition has no banner: its rule is the two draws in ConstraintRoll.
    case 'yourChoice': {
      const limit = yourChoiceLimit(state.config);
      return limit >= state.config.playersPerTeam
        ? t('board.freeBanner')
        : t('board.clubLimitBanner', { max: limit });
    }
    default:
      return t('board.freeBanner');
  }
}
