import { DIAMOND, DIAMOND_CORE, STAR_OUTER } from "./paths";

interface TatreezProps {
  className?: string;
  stroke?: string;
}

/**
 * Stitch cluster used in the RSVP and guestbook confirmation sequences:
 * an eight-point star centered in the 96×96 box with a small diamond
 * capping each of its four points. Every element shares the (48,48)
 * center — the star's tips stop 4 units short of each diamond's tip, so
 * nothing overlaps and the motif reads as one symmetric medallion.
 */
export function TatreezCluster({
  className = "",
  stroke = "currentColor",
}: TatreezProps) {
  // Diamond boxes are 24×24; these translates place their inner tips at
  // (48,22)/(22,48)/(74,48)/(48,74) — a 4-unit gap from the star tips at
  // (48,26)/(26,48)/(70,48)/(48,70), wide enough to survive stroke width.
  const positions = [
    { x: 36, y: 0, delay: 0 }, // north
    { x: 0, y: 36, delay: 0.15 }, // west
    { x: 72, y: 36, delay: 0.3 }, // east
    { x: 36, y: 72, delay: 0.45 }, // south
  ];
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {positions.map((p, i) => (
        <g key={i} transform={`translate(${p.x},${p.y})`}>
          <path
            d={DIAMOND}
            stroke={stroke}
            strokeWidth="1.25"
            pathLength="1"
            className="thread-path"
            style={{ animationDelay: `${p.delay}s` }}
          />
          <path
            d={DIAMOND_CORE}
            stroke={stroke}
            strokeWidth="1"
            pathLength="1"
            className="thread-path"
            style={{ animationDelay: `${p.delay + 0.25}s` }}
          />
        </g>
      ))}
      <g transform="translate(24,24)">
        <path
          d={STAR_OUTER}
          stroke={stroke}
          strokeWidth="1.5"
          pathLength="1"
          className="thread-path"
          style={{ animationDelay: "0.7s" }}
        />
        {/* Small core diamond, clear of the star's shoulder vertices
            (STAR_INNER would pass exactly through them). */}
        <path
          d="M24 16 L32 24 L24 32 L16 24 Z"
          stroke={stroke}
          strokeWidth="1"
          pathLength="1"
          className="thread-path"
          style={{ animationDelay: "1s" }}
        />
      </g>
    </svg>
  );
}
