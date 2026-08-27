'use client';

import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Framer Motion's scroll-triggered opacity reveals can stall mid-transition
 * under heavy main-thread work from a fast/large scroll (many simultaneous
 * IntersectionObserver callbacks, rapid rAF churn) and never recover, since
 * nothing re-triggers a `once: true` animation once it has fired. Confirmed
 * live: a fully-in-viewport section stuck at a fractional computed opacity
 * (e.g. 0.0688) for 5+ seconds. This is a safety-net watchdog — once the
 * element is confirmed in view, if it hasn't visually settled to full
 * opacity within `timeoutMs`, force it there directly.
 */
export function useOpacitySettle(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  timeoutMs = 1500
) {
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const opacity = parseFloat(getComputedStyle(el).opacity);
      if (!Number.isNaN(opacity) && opacity < 0.95) {
        el.style.setProperty('opacity', '1', 'important');
      }
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [active, ref, timeoutMs]);
}
