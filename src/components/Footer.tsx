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
    </footer>
  );
}
