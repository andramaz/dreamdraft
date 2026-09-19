import type { CSSProperties } from 'react';
import { clamp, Easing, MOTION } from './motion';
import {
  BURST_DOTS,
  BURST_LIFE,
  BURSTS,
  CONFETTI,
  STREAMERS,
} from './particles';
import {
  AUTHORED_TOTAL,
  CUES,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  useCelebrationClock,
  useStageScale,
} from './useCelebration';

const TROPHY_SRC = '/trophy.png';
const CUP_WIDTH = 412;
const CUP_HEIGHT = 734;
/** Confetti, streamers and fireworks all hang off the crowning moment. */
const PARTY_START = CUES.crowning - 0.3;

export interface CelebrationStageProps {
  /** Already upper-cased for the active language. */
  winner: string;
  /** Small spaced label above the name. */
  label: string;
  /** Spaced line under the name. */
  subtitle: string;
  /** 6-digit hex — the light, the glow and the label take this colour. */
  accent?: string;
}

/**
 * The champion celebration, authored at 1920x1080 and scaled to fit. It keeps
 * to its own box: nothing here touches the page around it.
 */
export function CelebrationStage({
  winner,
  label,
  subtitle,
  accent = '#5fb8ff',
}: CelebrationStageProps) {
  const { t, ambient } = useCelebrationClock();
  const { ref, scale } = useStageScale<HTMLDivElement>();

  // Camera: rise from below, settle, slow push in, then a final pull-out.
  const camY =
    MOTION.enter(360, 0, 0, 3.4)(t) +
    MOTION.drift(0, -26, CUES.crowning, AUTHORED_TOTAL)(t);
  const camScale =
    MOTION.enter(1.28, 1, 0.2, 3.6)(t) +
    MOTION.drift(0, 0.08, CUES.shine, CUES.crowning)(t) +
    MOTION.drift(0, -0.16, CUES.celebration - 0.4, AUTHORED_TOTAL)(t);
  const bob = Math.sin(ambient * 0.8) * 7;
  const spin = MOTION.drift(-14, 0, 0, 4.2)(t) + Math.sin(ambient * 0.45) * 1.6;

  const reveal = MOTION.enter(0, 1, 0.3, 2.6)(t);
  const sheen = -120 + ((ambient * 26) % 260);
  const glow = MOTION.drift(0, 1, CUES.shine - 0.3, CUES.shine + 1.2)(t);

  return (
    <div
      ref={ref}
      className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-[#02060f] shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
      style={{ aspectRatio: `${STAGE_WIDTH} / ${STAGE_HEIGHT}` }}
    >
      <div
        aria-hidden={scale === 0}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          visibility: scale === 0 ? 'hidden' : 'visible',
        }}
      >
        <Arena t={t} ambient={ambient} accent={accent} />

        {/* Soft ball of light behind the cup, lit at the Shine cue. */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '42%',
            width: 900,
            height: 900,
            marginLeft: -450,
            marginTop: -450,
            background: `radial-gradient(50% 50% at 50% 50%, ${accent}55, transparent 68%)`,
            opacity: glow,
            filter: 'blur(10px)',
          }}
        />

        {/* The cup — one element, alive from the first frame to the last. */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) translateY(${camY + bob - 168}px) scale(${camScale}) rotateZ(${spin * 0.18}deg) rotateY(${spin * 0.4}deg)`,
            opacity: reveal,
            filter: `drop-shadow(0 40px 60px rgba(0,0,0,.65)) brightness(${0.62 + 0.38 * Math.max(reveal, glow)})`,
            transformStyle: 'preserve-3d',
          }}
        >
          <Cup sheen={sheen} />
        </div>

        <Confetti />
        <Streamers t={t} />
        <Fireworks t={t} />

        <Lockup
          t={t}
          winner={winner}
          label={label}
          subtitle={subtitle}
          accent={accent}
        />

        {/* Vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(75% 70% at 50% 45%, transparent 55%, rgba(0,2,10,.72) 100%)',
          }}
        />
      </div>
    </div>
  );
}

function Arena({
  t,
  ambient,
  accent,
}: {
  t: number;
  ambient: number;
  accent: string;
}) {
  const lift = MOTION.drift(0, 1, 0, 12.5)(t);
  const rays = Array.from({ length: 7 }, (_, i) => {
    const angle = -46 + i * 15.5;
    const alpha = 0.1 + 0.12 * (0.5 + 0.5 * Math.sin(ambient * 0.55 + i * 1.3));
    const stop = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0');
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: '50%',
          top: '-40%',
          width: 220 + i * 26,
          height: '180%',
          transformOrigin: '50% 0%',
          transform: `translateX(-50%) rotate(${angle + lift * 6}deg)`,
          background: `linear-gradient(180deg, ${accent}00 0%, ${accent}${stop} 45%, ${accent}00 100%)`,
          filter: 'blur(26px)',
          opacity: 0.8,
        }}
      />
    );
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: '#040a1c',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(120% 90% at 50% 8%, #123a86 0%, #0b1f52 38%, #050c22 72%, #02060f 100%)',
        }}
      />
      {rays}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(38% 48% at 50% 46%, ${accent}2e 0%, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 320,
          background: 'linear-gradient(180deg, transparent, #01040c 78%)',
        }}
      />
    </div>
  );
}

function Cup({ sheen }: { sheen: number }) {
  // Both light passes are clipped to the trophy's own silhouette.
  const mask: CSSProperties = {
    WebkitMaskImage: `url(${TROPHY_SRC})`,
    maskImage: `url(${TROPHY_SRC})`,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
  };

  return (
    <div style={{ position: 'relative', width: CUP_WIDTH, height: CUP_HEIGHT }}>
      <img
        src={TROPHY_SRC}
        alt=""
        width={CUP_WIDTH}
        height={CUP_HEIGHT}
        style={{
          display: 'block',
          width: CUP_WIDTH,
          height: CUP_HEIGHT,
          filter:
            'drop-shadow(0 26px 40px rgba(0,0,0,.65)) contrast(1.14) saturate(0.9) brightness(1.05)',
        }}
      />
      {/* Travelling specular sheen */}
      <div
        style={{
          ...mask,
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          background:
            'linear-gradient(104deg, rgba(255,255,255,0) 40%, rgba(255,255,255,.75) 50%, rgba(255,255,255,0) 60%)',
          backgroundSize: '260% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPositionX: `${sheen}%`,
        }}
      />
      {/* Cool rim light from the stage */}
      <div
        style={{
          ...mask,
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
          opacity: 0.35,
          background:
            'linear-gradient(200deg, rgba(120,190,255,.55), rgba(255,255,255,0) 55%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          marginLeft: -200,
          top: CUP_HEIGHT - 26,
          width: 400,
          height: 56,
          borderRadius: '50%',
          background:
            'radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.6), transparent 72%)',
        }}
      />
    </div>
  );
}

/**
 * The only swarm big enough to matter, so it runs on CSS keyframes: the
 * compositor carries 120 pieces without React re-rendering them every frame.
 */
function Confetti() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {CONFETTI.map((piece, index) => (
        <div
          key={index}
          className="animate-[champ-fall_linear_infinite_backwards]"
          style={{
            position: 'absolute',
            left: `${piece.x}%`,
            top: 0,
            animationDuration: `${piece.duration}s`,
            animationDelay: `${PARTY_START + piece.delay}s`,
          }}
        >
          <div
            className="animate-[champ-sway_ease-in-out_infinite_alternate_backwards]"
            style={{
              animationDuration: `${piece.duration * 0.75}s`,
              animationDelay: `${PARTY_START + piece.delay - piece.swayPhase * piece.duration * 0.75}s`,
              ['--champ-sway' as string]: `${piece.sway}px`,
            }}
          >
            <div
              className="animate-[champ-spin_linear_infinite_backwards]"
              style={{
                width: piece.size,
                height: piece.size * piece.ratio,
                background: piece.color,
                borderRadius: piece.round ? '50%' : 2,
                boxShadow: '0 0 8px rgba(255,255,255,.25)',
                animationDuration: `${piece.duration}s`,
                animationDelay: `${PARTY_START + piece.delay}s`,
                ['--champ-spin' as string]: `${piece.spin}deg`,
                ['--champ-spin-x' as string]: `${piece.spin * 1.6}deg`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Streamers({ t }: { t: number }) {
  const local = t - (CUES.crowning + 0.6);
  if (local < 0 || local > 4) return null;
  const out = clamp(1 - (local - 2.2) / 1.6, 0, 1);

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        filter: 'blur(1.5px)',
      }}
    >
      {STREAMERS.map((streamer, index) => {
        const p = clamp((local - streamer.delay) / 1.5, 0, 1);
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: `${streamer.x}%`,
              top: -40,
              width: 2,
              height: streamer.length,
              background: `linear-gradient(180deg, ${streamer.color}, transparent)`,
              transform: `translateY(${Easing.easeOutCubic(p) * (STAGE_HEIGHT * 0.55)}px)`,
              opacity: 0.4 * (1 - p * 0.5) * out,
            }}
          />
        );
      })}
    </div>
  );
}

function Fireworks({ t }: { t: number }) {
  const local = t - (CUES.crowning + 0.2);
  const dots: React.ReactElement[] = [];

  BURSTS.forEach((burst, burstIndex) => {
    const age = local - burst.at;
    if (age < 0 || age > BURST_LIFE) return;
    const p = age / BURST_LIFE;
    const radius = 40 + Easing.easeOutQuart(p) * 300;
    const opacity = p < 0.12 ? p / 0.12 : (1 - p) ** 1.6;

    for (let i = 0; i < BURST_DOTS; i++) {
      const angle = (i / BURST_DOTS) * Math.PI * 2 + burstIndex;
      dots.push(
        <div
          key={`${burstIndex}-${i}`}
          style={{
            position: 'absolute',
            left: `${burst.x}%`,
            top: `${burst.y}%`,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: burst.color,
            opacity,
            transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius * 0.82 + p * 70}px)`,
            boxShadow: `0 0 14px ${burst.color}`,
          }}
        />,
      );
    }
  });

  return (
    <div
      aria-hidden
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {dots}
    </div>
  );
}

function Lockup({
  t,
  winner,
  label,
  subtitle,
  accent,
}: {
  t: number;
  winner: string;
  label: string;
  subtitle: string;
  accent: string;
}) {
  const labelIn = MOTION.enter(
    0,
    1,
    CUES.crowning - 0.2,
    CUES.crowning + 0.7,
  )(t);
  const letters = [...winner];
  const size = letters.length > 13 ? 88 : letters.length > 10 ? 104 : 122;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 96,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
      }}
    >
      <div
        style={{
          fontFamily: '"Barlow Condensed", Inter, sans-serif',
          fontWeight: 500,
          fontSize: 32,
          letterSpacing: 15,
          textIndent: 15,
          lineHeight: 1,
          color: accent,
          opacity: labelIn,
          transform: `translateY(${(1 - labelIn) * 22}px)`,
        }}
      >
        {label}
      </div>

      {/* The name is drawn letter by letter, so it is labelled as one word. */}
      <div
        role="heading"
        aria-level={2}
        aria-label={winner}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-end',
          gap: 3,
          height: size * 1.16,
        }}
      >
        {letters.map((character, index) => {
          const at = CUES.crowning + 0.55 + index * 0.07;
          const on = clamp(MOTION.pop(0, 1, at, at + 0.62)(t), 0, 1);
          return (
            <span
              key={index}
              aria-hidden
              style={{
                fontFamily: 'Oswald, Oxanium, sans-serif',
                fontWeight: 600,
                fontSize: size,
                lineHeight: 1.16,
                letterSpacing: 1,
                color: '#fff',
                opacity: on,
                transform: `translateY(${(1 - on) * 64}px) scale(${0.88 + on * 0.12})`,
                textShadow: `0 0 34px ${accent}b3, 0 6px 26px rgba(0,0,0,.65)`,
                whiteSpace: 'pre',
              }}
            >
              {character}
            </span>
          );
        })}
      </div>

      <div
        style={{
          fontFamily: '"Barlow Condensed", Inter, sans-serif',
          fontSize: 28,
          letterSpacing: 11,
          textIndent: 11,
          lineHeight: 1,
          color: 'rgba(214,230,250,.8)',
          opacity: MOTION.enter(
            0,
            1,
            CUES.crowning + 1.5,
            CUES.crowning + 2.2,
          )(t),
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}
