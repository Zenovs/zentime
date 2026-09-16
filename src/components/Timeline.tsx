import { MapPin, Video } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatDuration, formatTime } from '../logic/day';
import { displayTitle } from '../logic/hero';
import { barRatio, eventIcon, eventStatus, longestDuration } from '../logic/timeline';
import type { CalendarEvent } from '../model/event';
import { cx } from './ui';

interface TimelineProps {
  events: readonly CalendarEvent[];
  now: number;
  zone: string;
  colorFor: (ev: CalendarEvent) => string;
  selectedId: string | null;
  focusId: string | null;
  hasAllDayRow: boolean;
  privateMode: boolean;
  onSelect: (id: string) => void;
}

/** Nur Video und Ort bekommen ein Symbol; sonst trägt der Balken die Farbe */
function RowIcon({ ev }: { ev: CalendarEvent }) {
  const kind = eventIcon(ev);
  if (kind === 'video') return <Video size={16} strokeWidth={1.5} className="flex-none text-muted" aria-hidden />;
  if (kind === 'pin') return <MapPin size={16} strokeWidth={1.5} className="flex-none text-muted" aria-hidden />;
  return null;
}

/** Ein Termin pro Zeile, Balken proportional zur Dauer (7.3) */
export function Timeline({ events, now, zone, colorFor, selectedId, focusId, hasAllDayRow, privateMode, onSelect }: TimelineProps) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !focusId) return;
    el.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(focusId)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [focusId, events.length]);

  if (events.length === 0) return null;
  const longest = longestDuration(events);

  return (
    <div
      ref={scroller}
      role="list"
      aria-label="Termine heute"
      className={cx('-mx-2 mb-6 flex min-h-0 flex-1 flex-col overflow-y-auto px-2 no-scrollbar', hasAllDayRow ? 'mt-3' : 'mt-6')}
    >
      {events.map((ev) => {
        const status = eventStatus(ev, now);
        const running = status === 'running';
        const selected = ev.id === selectedId;
        // Termine mit Vorbehalt erscheinen gedimmt (F-13)
        const tentative = ev.showAs === 'tentative' || ev.response === 'tentative';
        return (
          <button
            key={ev.id}
            type="button"
            role="listitem"
            data-event-id={ev.id}
            aria-current={running ? 'time' : undefined}
            aria-pressed={selected}
            title={privateMode ? undefined : displayTitle(ev)}
            onClick={() => onSelect(ev.id)}
            className={cx(
              // zentime zeigt nur an: keine Hover- oder Auswahlflächen, der
              // laufende und der ausgewählte Termin werden über die Schrift
              // hervorgehoben.
              'flex w-full flex-none items-center gap-3 px-2 py-2 text-left',
              status === 'past' && 'opacity-40',
              status !== 'past' && tentative && 'opacity-60',
            )}
          >
            <span className={cx('tnum flex-none text-[13px] leading-4', running || selected ? 'text-fg' : 'text-muted')}>
              {formatTime(ev.start, zone)}
            </span>
            <span className="h-1.5 w-9 flex-none overflow-hidden rounded-full bg-fg/15" aria-hidden>
              <span
                className="block h-full rounded-full"
                style={{ width: `${barRatio(ev.end - ev.start, longest) * 100}%`, backgroundColor: colorFor(ev) }}
              />
            </span>
            <RowIcon ev={ev} />
            <span className="min-w-0 flex-1 truncate text-[15px] leading-5 font-semibold">
              {privateMode ? 'Termin' : displayTitle(ev)}
            </span>
            <span className={cx('tnum flex-none text-[13px] leading-4', running || selected ? 'text-fg' : 'text-muted')}>
              {formatDuration(ev.end - ev.start)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
