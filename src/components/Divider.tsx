/**
 * Cross-stitch divider ornament (supplied artwork): arrow-tipped thread
 * running through diamonds to a central eight-point star medallion.
 */
export function Divider({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/image/divider.webp"
      alt=""
      aria-hidden="true"
      className={`block h-auto select-none ${className}`}
      draggable={false}
    />
  );
}
