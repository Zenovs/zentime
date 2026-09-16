import type { Hero as HeroData } from '../logic/hero';

interface HeroProps {
  hero: HeroData;
  privateMode: boolean;
}

/** Grosse Zahl bzw. Uhrzeit mit Einheit auf der Grundlinie, darunter der Titel (7.2) */
export function Hero({ hero, privateMode }: HeroProps) {
  const text = privateMode && hero.eventId ? 'Termin' : hero.text;
  return (
    <section className="mt-6 flex flex-col gap-2" aria-live="polite">
      <div key={`${hero.big}${hero.unit ?? ''}`} className="fade flex items-baseline gap-2">
        <span
          className="tnum font-extrabold tracking-[-0.04em]"
          style={{ fontSize: 'clamp(64px, 15.5vh, 96px)', lineHeight: 1 }}
        >
          {hero.big}
        </span>
        {hero.unit ? <span className="text-2xl leading-8 font-semibold text-muted">{hero.unit}</span> : null}
      </div>
      <div key={text} className="fade truncate text-lg leading-6 font-semibold">
        {hero.muted ? <span className="text-muted">{hero.muted}</span> : null}
        {text}
      </div>
    </section>
  );
}
