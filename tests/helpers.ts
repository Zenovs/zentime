import { DateTime } from 'luxon';
import type { CalendarEvent } from '../src/model/event';

export const ZONE = 'Europe/Zurich';
/** Fester Testtag: Mittwoch, 16. September 2026 */
export const DAY = '2026-09-16';

/** `at('09:35')` → Epoch-ms am Testtag; `at('09:35', '2026-09-17')` für andere Tage */
export function at(hhmm: string, day = DAY): number {
  return DateTime.fromISO(`${day}T${hhmm}`, { zone: ZONE }).toMillis();
}

let counter = 0;

export function ev(
  title: string,
  start: string,
  end: string,
  extra: Partial<CalendarEvent> & { day?: string; endDay?: string } = {},
): CalendarEvent {
  const { day = DAY, endDay = day, ...rest } = extra;
  counter += 1;
  return {
    id: `t:${counter}`,
    sourceId: 't',
    calendarName: 'Test',
    title,
    start: at(start, day),
    end: at(end, endDay),
    allDay: false,
    location: null,
    onlineUrl: null,
    webLink: null,
    isCancelled: false,
    response: 'accepted',
    showAs: 'busy',
    isPrivate: false,
    ...rest,
  };
}

export function allDay(title: string, day = DAY, days = 1, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  const start = DateTime.fromISO(day, { zone: ZONE }).startOf('day');
  return ev(title, '00:00', '00:00', {
    ...extra,
    allDay: true,
    start: start.toMillis(),
    end: start.plus({ days }).toMillis(),
  });
}

export function hhmm(ms: number): string {
  return DateTime.fromMillis(ms, { zone: ZONE }).toFormat('HH:mm');
}

export function iso(ms: number): string {
  return DateTime.fromMillis(ms, { zone: ZONE }).toISO({ suppressMilliseconds: true }) ?? '';
}
