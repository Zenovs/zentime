import { MapPin, Video } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatDuration, formatTime } from '../logic/day';
import { displayTitle } from '../logic/hero';
import { eventIcon, eventStatus } from '../logic/timeline';
import type { CalendarEvent } from '../model/event';
import { cx } from './ui';

interface TimelineProps {
  events: readonly CalendarEvent[];
  now: number;
  zone: string;
  selectedId: string | null;
  focusId: string | null;
  hasAllDayRow: boolean;
  privateMode: boolean;
  onSelect: (id: string) => void;
}

function ColumnIcon({ ev }: { ev: CalendarEvent }) {
  const kind = eventIcon(ev);
  if (kind === 'video') return <Video size={20} strokeWidth={1.5} aria-hidden />;
  if (kind === 'pin') return <MapPin size={20} strokeWidth={1.5} aria-hidden />;
  return (
    <span className="flex h-5 w-5 items-center justify-center" aria-hidden>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
    </span>
  );
}

/** Eine Spalte pro Termin, horizontal scrollbar (7.3) */
export function Timeline({ events, now, zone, selectedId, focusId, hasAllDayRow, privateMode, onSelect }: TimelineProps) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !focusId) return;
    const target = el.querySelector<HTMLElement>(`[data-event-id="${CSS.escape(focusId)}"]`);
    if (!target) return;
    const padding = 24;
    el.scrollTo({ left: Math.max(0, target.offsetLeft - padding), behavior: 'auto' });
  }, [focusId, events.length]);

  if (events.length === 0) return null;

  return (
    <div
      ref={scroller}
      role="list"
      aria-label="Termine heute"
      onWheel={(e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && scroller.current) {
          scroller.current.scrollLeft += e.deltaY;
        }
      }}
      className={cx('edge-fade -mx-6 mb-6 flex gap-2 overflow-x-auto px-6 no-scrollbar', hasAllDayRow ? 'mt-3' : 'mt-6')}
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
              'flex w-[60px] flex-none flex-col items-center gap-2 rounded-xl py-3 transition-colors',
              (selected || running) && 'bg-line',
              !selected && !running && 'hover:bg-line/60',
              status === 'past' && 'opacity-40',
              status !== 'past' && tentative && 'opacity-60',
            )}
          >
            <span className={cx('tnum text-[13px] leading-4', running ? 'text-fg' : 'text-muted')}>{formatTime(ev.start, zone)}</span>
            <span className="text-fg">
              <ColumnIcon ev={ev} />
            </span>
            <span className="tnum text-sm leading-5 font-semibold whitespace-nowrap">{formatDuration(ev.end - ev.start)}</span>
          </button>
        );
      })}
    </div>
  );
}
