interface WheelEntry {
  id: string;
  name: string;
}

interface WheelProps {
  entries: WheelEntry[];
  /** Absolute rotation in degrees; changing it animates the spin. */
  rotation: number;
  durationMs: number;
}

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = CENTER - 8;

// Cyan → violet → magenta, like the UCL draw graphics.
const SEGMENT_FILLS = [
  'rgb(37 99 235 / 0.95)',
  'rgb(14 165 233 / 0.95)',
  'rgb(99 102 241 / 0.95)',
  'rgb(192 71 216 / 0.95)',
];

/** Fortune wheel used for the pick-order draw. */
export function Wheel({ entries, rotation, durationMs }: WheelProps) {
  const segment = 360 / Math.max(entries.length, 1);
  const fontSize = entries.length > 10 ? 10 : entries.length > 6 ? 12 : 14;

  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      {/* pointer */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-1/2 z-10 -translate-x-1/2 -translate-y-1 text-2xl text-gold drop-shadow-[0_0_8px_rgba(245,210,122,0.8)]"
      >
        ▼
      </div>

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full drop-shadow-[0_0_45px_rgba(76,201,255,0.45)]"
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS + 6}
          fill="rgb(9 18 70)"
          stroke="rgb(247 217 138 / 0.65)"
          strokeWidth="2"
        />
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: '50% 50%',
            transition:
              durationMs > 0
                ? `transform ${durationMs}ms cubic-bezier(0.16, 1, 0.3, 1)`
                : undefined,
          }}
        >
          {entries.map((entry, index) => {
            const start = index * segment;
            const mid = start + segment / 2;
            // Labels on the left half are flipped so they never read upside down.
            const flipped = mid > 180;
            return (
              <g key={entry.id}>
                <path
                  d={segmentPath(start, start + segment)}
                  fill={SEGMENT_FILLS[index % SEGMENT_FILLS.length]}
                  stroke="rgb(255 255 255 / 0.12)"
                />
                {/* Radial label: reads outwards from the hub, like a real wheel. */}
                <text
                  transform={`rotate(${flipped ? mid + 90 : mid - 90} ${CENTER} ${CENTER})`}
                  x={CENTER + (flipped ? -1 : 1) * RADIUS * 0.88}
                  y={CENTER}
                  textAnchor={flipped ? 'start' : 'end'}
                  dominantBaseline="middle"
                  fontSize={fontSize}
                  fontWeight="700"
                  fill="white"
                >
                  {entry.name.length > 14
                    ? `${entry.name.slice(0, 13)}…`
                    : entry.name}
                </text>
              </g>
            );
          })}
        </g>
        <circle
          cx={CENTER}
          cy={CENTER}
          r="18"
          fill="rgb(14 27 99)"
          stroke="rgb(76 201 255 / 0.8)"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

/** Pie slice between two angles, measured clockwise from the top. */
function segmentPath(startDeg: number, endDeg: number): string {
  if (endDeg - startDeg >= 360) {
    return `M ${CENTER} ${CENTER - RADIUS} A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER - 0.01} ${CENTER - RADIUS} Z`;
  }
  const start = pointOnCircle(startDeg);
  const end = pointOnCircle(endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

function pointOnCircle(angleDeg: number) {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CENTER + RADIUS * Math.cos(radians),
    y: CENTER + RADIUS * Math.sin(radians),
  };
}
