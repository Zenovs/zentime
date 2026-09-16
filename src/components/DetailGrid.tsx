import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatTime } from '../logic/day';
import type { Gap } from '../logic/gaps';
import { formatRemaining } from '../logic/timeline';
import type { CalendarEvent } from '../model/event';
import { openExternal } from '../platform/shell';
import { Dot, cx } from './ui';

interface DetailGridProps {
  event: CalendarEvent | null;
  zone: string;
  remaining: number;
  gap: Gap | null;
  color: string | null;
  privateMode: boolean;
  /** Der ausgewählte Termin gehört zu morgen (F-12) */
  isTomorrow: boolean;
}

const DASH = '–';

function Cell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-1', className)}>
      <div className="text-[13px] leading-4 text-muted">{label}</div>
      <div className="tnum flex min-w-0 items-center gap-2 text-lg leading-6 font-semibold">{children}</div>
    </div>
  );
}

function Text({ children, title }: { children: string; title?: string }) {
  return (
    <span className="min-w-0 truncate" title={title}>
      {children}
    </span>
  );
}

export function onlineLabel(url: string): string {
  if (/teams\.(microsoft|live)\.com/i.test(url)) return 'Teams';
  if (/meet\.google\.com/i.test(url)) return 'Meet';
  if (/zoom\.us/i.test(url)) return 'Zoom';
  if (/webex\.com/i.test(url)) return 'Webex';
  return 'Online';
}

export function formatGap(gap: Gap | null, zone: string): string {
  if (!gap) return DASH;
  if (gap.end === null) return `ab ${formatTime(gap.start, zone)}`;
  return `${formatTime(gap.start, zone)}–${formatTime(gap.end, zone)}`;
}

/** Zwei Spalten, Label klein und sekundär, Wert fett (7.4) */
export function DetailGrid({ event, zone, remaining, gap, color, privateMode, isTomorrow }: DetailGridProps) {
  const row = 'grid grid-cols-2 gap-4 py-2';
  const line = 'border-b border-line';
  const hidden = privateMode && !!event;

  const start = event ? (event.allDay ? 'Ganztägig' : formatTime(event.start, zone)) : DASH;
  const end = event && !event.allDay ? formatTime(event.end, zone) : DASH;
  const location = hidden ? DASH : (event?.location ?? '') || (event?.onlineUrl ? onlineLabel(event.onlineUrl) : DASH);

  return (
    <section className="mt-auto border-t border-line" aria-label="Details">
      <div className={cx(row, line)}>
        <Cell label={isTomorrow ? 'Beginn morgen' : 'Beginn'}>
          <Text>{start}</Text>
        </Cell>
        <Cell label="Ende">
          <Text>{end}</Text>
        </Cell>
      </div>
      <div className={cx(row, line)}>
        <Cell label="Ort">
          {event?.onlineUrl && !hidden ? (
            <button
              type="button"
              onClick={() => void openExternal(event.onlineUrl ?? '')}
              className="flex min-w-0 items-center gap-1.5 hover:text-muted"
              title="Meeting beitreten"
            >
              <Text>{location}</Text>
              <ExternalLink size={16} strokeWidth={1.5} className="flex-none text-muted" aria-hidden />
            </button>
          ) : (
            <Text title={location}>{location}</Text>
          )}
        </Cell>
        <Cell label="Kalender">
          {event && color ? <Dot color={color} /> : null}
          <Text>{event ? event.calendarName : DASH}</Text>
        </Cell>
      </div>
      <div className={cx(row, 'pb-0')}>
        <Cell label="Noch heute">
          <Text>{formatRemaining(remaining)}</Text>
        </Cell>
        <Cell label="Nächste Lücke">
          <Text>{formatGap(gap, zone)}</Text>
        </Cell>
      </div>
      {event && !hidden && (event.webLink || event.onlineUrl) ? (
        <div className="mt-3 flex items-center gap-4 text-[13px] leading-4 font-semibold">
          {event.onlineUrl ? (
            <button type="button" onClick={() => void openExternal(event.onlineUrl ?? '')} className="flex items-center gap-1 text-fg hover:text-muted">
              Beitreten <ExternalLink size={14} strokeWidth={1.5} aria-hidden />
            </button>
          ) : null}
          {event.webLink ? (
            <button type="button" onClick={() => void openExternal(event.webLink ?? '')} className="flex items-center gap-1 text-muted hover:text-fg">
              Öffnen <ExternalLink size={14} strokeWidth={1.5} aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
