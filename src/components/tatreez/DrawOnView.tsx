"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Adds the `is-drawn` class when the element enters the viewport, triggering
 * the CSS thread-draw animation on any `.thread-path` descendants.
 */
export function DrawOnView({
  children,
  className = "",
  threshold = 0.4,
}: {
  children: React.ReactNode;
  className?: string;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setDrawn(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div ref={ref} className={`${className} ${drawn ? "is-drawn" : ""}`.trim()}>
      {children}
    </div>
  );
}
