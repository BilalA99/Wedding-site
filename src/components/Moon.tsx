import { MOON_PATH } from "@/config/wedding";

/**
 * Silvered full moon (CC0, freesvg.org/full-moon) — the standalone
 * celestial accent used between sections in place of the star sparkle.
 */
export function Moon({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={MOON_PATH}
      alt=""
      aria-hidden="true"
      className={`select-none opacity-90 ${className}`}
      draggable={false}
    />
  );
}
