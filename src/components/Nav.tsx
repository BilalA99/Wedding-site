"use client";

import { useEffect, useState } from "react";

/**
 * Minimal editorial navigation: transparent over the bright hero, gaining a
 * translucent paper backdrop and hairline only after scrolling.
 */
export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${
        scrolled
          ? "hairline-blue border-b bg-paper/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-2.5 md:px-8">
        <a
          href="#top"
          aria-label="Bilal Ahmad and Jennah Samhan — top of page"
          className="block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/image/monogram.webp"
            alt=""
            className="h-11 w-11 object-contain md:h-12 md:w-12"
            draggable={false}
          />
        </a>
        <nav aria-label="Main" className="flex items-center">
          <a
            href="#rsvp"
            className="type-caps rounded-full border border-blue-deep/30 px-4 py-2 text-[0.62rem] text-blue-deep transition-colors duration-300 hover:border-blue-deep hover:bg-blue-deep hover:text-paper-pure"
          >
            RSVP
          </a>
        </nav>
      </div>
    </header>
  );
}
