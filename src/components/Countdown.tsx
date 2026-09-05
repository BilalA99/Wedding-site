"use client";

import { useEffect, useState } from "react";

import { WEDDING_START_UTC } from "@/config/wedding";

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function remainingUntil(target: Date): Remaining | null {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor(diff / 3_600_000) % 24,
    minutes: Math.floor(diff / 60_000) % 60,
    seconds: Math.floor(diff / 1000) % 60,
  };
}

export function Countdown() {
  const [remaining, setRemaining] = useState<Remaining | null | "loading">(
    "loading",
  );

  useEffect(() => {
    const target = new Date(WEDDING_START_UTC);
    const tick = () => setRemaining(remainingUntil(target));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (remaining === "loading") {
    return <div className="h-12" aria-hidden="true" />;
  }

  if (remaining === null) {
    return (
      <p className="type-caps text-xs text-blue-deep">
        Celebrating — with love, Bilal Ahmad &amp; Jennah Samhan
      </p>
    );
  }

  const units: { label: string; value: number }[] = [
    { label: "Days", value: remaining.days },
    { label: "Hours", value: remaining.hours },
    { label: "Minutes", value: remaining.minutes },
    { label: "Seconds", value: remaining.seconds },
  ];

  return (
    <div
      className="inline-flex items-baseline justify-center gap-0 divide-x divide-line-blue rounded-none border-y border-line-blue py-4"
      role="timer"
      aria-label={`${remaining.days} days until the wedding`}
    >
      {units.map((u) => (
        <div key={u.label} className="px-5 text-center md:px-8">
          <div className="type-display tabular text-2xl text-ink md:text-4xl">
            {String(u.value).padStart(2, "0")}
          </div>
          <div className="type-caps mt-1 text-[0.52rem] text-ink-soft md:text-[0.62rem]">
            {u.label}
          </div>
        </div>
      ))}
    </div>
  );
}
