import { displayTitle } from '../logic/hero';
import type { CalendarEvent } from '../model/event';
import { Dot } from './ui';

interface AllDayRowProps {
  events: readonly CalendarEvent[];
  colorFor: (ev: CalendarEvent) => string;
  privateMode: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Schmale Zeile über der Tagesleiste (F-05) */
export function AllDayRow({ events, colorFor, privateMode, selectedId, onSelect }: AllDayRowProps) {
  if (events.length === 0) return null;
  return (
    <div className="mt-6 flex items-center gap-2 overflow-hidden text-[13px] leading-[18px] whitespace-nowrap">
      <span className="text-muted">Ganztägig ·</span>
      <div className="flex min-w-0 items-center gap-3 overflow-x-auto no-scrollbar">
        {events.map((ev) => (
          <button
            key={ev.id}
            type="button"
            onClick={() => onSelect(ev.id)}
            title={privateMode ? undefined : displayTitle(ev)}
            className={`flex items-center gap-1.5 rounded font-semibold ${ev.id === selectedId ? 'text-fg' : 'text-fg/80 hover:text-fg'}`}
          >
            <Dot color={colorFor(ev)} size={6} />
            <span className="truncate">{privateMode ? 'Termin' : displayTitle(ev)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
