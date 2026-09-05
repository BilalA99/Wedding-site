import { DrawOnView } from "@/components/tatreez/DrawOnView";
import { TatreezStar } from "@/components/tatreez/Tatreez";

export function Footer() {
  return (
    <footer className="bg-charcoal px-6 py-16 text-center">
      <DrawOnView className="mx-auto mb-6 flex justify-center text-gold/50">
        <TatreezStar className="w-8" />
      </DrawOnView>
      <p className="font-display text-2xl text-ivory">Bilal &amp; Jennah</p>
      <p className="type-caps mt-2 text-[0.6rem] text-sand/60">October 2026</p>
    </footer>
  );
}
