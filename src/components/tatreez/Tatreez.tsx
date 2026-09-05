import { DIAMOND, DIAMOND_CORE, STAR_OUTER } from "./paths";

interface TatreezProps {
  className?: string;
  stroke?: string;
}

/** Diamond cluster used in the RSVP confirmation stitch sequence. */
export function TatreezCluster({
  className = "",
  stroke = "currentColor",
}: TatreezProps) {
  const positions = [
    { x: 36, y: 0, delay: 0 },
    { x: 12, y: 24, delay: 0.2 },
    { x: 60, y: 24, delay: 0.35 },
    { x: 36, y: 48, delay: 0.5 },
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
          style={{ animationDelay: "0.75s" }}
        />
      </g>
    </svg>
  );
}
