import { DrawOnView } from "@/components/tatreez/DrawOnView";
import { Moon } from "@/components/Moon";

export function Footer() {
  return (
    <footer className="border-t border-line-blue bg-paper px-6 py-16 text-center">
      <DrawOnView className="mx-auto mb-6 flex justify-center text-dusty">
        <Moon className="w-9" />
      </DrawOnView>
      <p className="font-display text-2xl text-ink">
        Bilal Ahmad <span className="text-dusty italic">&amp;</span> Jennah
        Samhan
      </p>
      <p className="type-caps mt-2 text-[0.6rem] text-ink-soft">October 2026</p>
      <nav
        aria-label="Legal"
        className="mt-8 flex items-center justify-center gap-5"
      >
        <a
          href="/guestbook"
          className="type-caps text-[0.55rem] text-ink-soft/80 transition-colors hover:text-ink"
        >
          Guestbook
        </a>
        <a
          href="/privacy"
          className="type-caps text-[0.55rem] text-ink-soft/80 transition-colors hover:text-ink"
        >
          Privacy
        </a>
        <a
          href="/terms"
          className="type-caps text-[0.55rem] text-ink-soft/80 transition-colors hover:text-ink"
        >
          Terms
        </a>
      </nav>
    </footer>
  );
}
