const STARS = [
  { x: 8, y: 12, size: 26, rotate: -12, opacity: 0.07 },
  { x: 78, y: 6, size: 34, rotate: 14, opacity: 0.09 },
  { x: 92, y: 48, size: 18, rotate: -8, opacity: 0.06 },
  { x: 18, y: 62, size: 22, rotate: 20, opacity: 0.05 },
  { x: 55, y: 88, size: 30, rotate: -18, opacity: 0.06 },
  { x: 36, y: 30, size: 14, rotate: 6, opacity: 0.045 },
];

/** Decorative UCL-style star motifs behind the page. */
export function StarField() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {STARS.map((star, index) => (
        <svg
          key={index}
          viewBox="0 0 24 24"
          className="absolute text-white blur-[3px]"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}vmin`,
            opacity: star.opacity,
            transform: `rotate(${star.rotate}deg)`,
          }}
        >
          <path
            fill="currentColor"
            d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7.3L12 17.7 5.7 21.5l1.7-7.3L2 9.5l7.1-.6z"
          />
        </svg>
      ))}
    </div>
  );
}
