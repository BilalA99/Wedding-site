import {
  CYPRESS,
  DIAMOND,
  DIAMOND_CORE,
  STAR_INNER,
  STAR_OUTER,
  ZIGZAG,
} from "./paths";

interface TatreezProps {
  className?: string;
  stroke?: string;
}

/** Eight-point star — the anchor motif. */
export function TatreezStar({
  className = "",
  stroke = "currentColor",
}: TatreezProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d={STAR_OUTER}
        stroke={stroke}
        strokeWidth="1.25"
        pathLength="1"
        className="thread-path"
      />
      <path
        d={STAR_INNER}
        stroke={stroke}
        strokeWidth="1"
        pathLength="1"
        className="thread-path"
        style={{ animationDelay: "0.5s" }}
      />
    </svg>
  );
}

/** Horizontal divider: zigzag runs flanking a central star. */
export function TatreezDivider({
  className = "",
  stroke = "currentColor",
}: TatreezProps) {
  return (
    <svg
      viewBox="0 0 240 24"
      fill="none"
      aria-hidden="true"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <g transform="translate(0,6)">
        <path
          d={ZIGZAG}
          transform="translate(20,0)"
          stroke={stroke}
          strokeWidth="1"
          pathLength="1"
          className="thread-path"
        />
        <path
          d={ZIGZAG}
          transform="translate(64,0)"
          stroke={stroke}
          strokeWidth="1"
          pathLength="1"
          className="thread-path"
          style={{ animationDelay: "0.15s" }}
        />
      </g>
      <g transform="translate(108,0) scale(0.5)">
        <path
          d={STAR_OUTER}
          stroke={stroke}
          strokeWidth="2"
          pathLength="1"
          className="thread-path"
          style={{ animationDelay: "0.3s" }}
        />
      </g>
      <g transform="translate(136,6)">
        <path
          d={ZIGZAG}
          stroke={stroke}
          strokeWidth="1"
          pathLength="1"
          className="thread-path"
          style={{ animationDelay: "0.45s" }}
        />
        <path
          d={ZIGZAG}
          transform="translate(44,0)"
          stroke={stroke}
          strokeWidth="1"
          pathLength="1"
          className="thread-path"
          style={{ animationDelay: "0.6s" }}
        />
      </g>
    </svg>
  );
}

/** Corner ornament for framed sections (top-left orientation by default). */
export function TatreezCorner({
  className = "",
  stroke = "currentColor",
}: TatreezProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2 62 L2 14 L14 2 L62 2"
        stroke={stroke}
        strokeWidth="1.25"
        pathLength="1"
        className="thread-path"
      />
      <g transform="translate(8,8) scale(0.6)">
        <path
          d={DIAMOND}
          stroke={stroke}
          strokeWidth="1.5"
          pathLength="1"
          className="thread-path"
          style={{ animationDelay: "0.4s" }}
        />
        <path
          d={DIAMOND_CORE}
          stroke={stroke}
          strokeWidth="1.25"
          pathLength="1"
          className="thread-path"
          style={{ animationDelay: "0.7s" }}
        />
      </g>
    </svg>
  );
}

/** Cypress (saru) column — used as a vertical accent. */
export function TatreezCypress({
  className = "",
  stroke = "currentColor",
}: TatreezProps) {
  return (
    <svg
      viewBox="0 0 16 28"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d={CYPRESS}
        stroke={stroke}
        strokeWidth="1"
        strokeLinecap="round"
        pathLength="1"
        className="thread-path"
      />
    </svg>
  );
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
