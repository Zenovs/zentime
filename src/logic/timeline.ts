import type { CalendarEvent, TimeWindow } from '../model/event';
import { overlaps } from '../model/event';

export interface DayFilterOptions {
  /** Abgelehnte Termine ausblenden (F-13, umschaltbar) */
  hideDeclined: boolean;
}

export interface DayEvents {
  /** Zeitgebundene Termine, die den Tag berühren, nach Beginn sortiert */
  timed: CalendarEvent[];
  /** Ganztägige Termine, die den Tag berühren */
  allDay: CalendarEvent[];
}

export type EventStatus = 'past' | 'running' | 'upcoming';

export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  return a.start - b.start || a.end - b.end || a.title.localeCompare(b.title, 'de');
}

/**
 * Filtert die Termine eines Tages (F-01, F-05, F-13). Abgesagte Termine
 * werden immer ausgeblendet, abgelehnte je nach Einstellung. Termine über
 * Mitternacht erscheinen an beiden Tagen.
 */
export function eventsForDay(
  events: readonly CalendarEvent[],
  window: TimeWindow,
  opts: DayFilterOptions,
): DayEvents {
  const visible = events.filter(
    (ev) => !ev.isCancelled && !(opts.hideDeclined && ev.response === 'declined') && overlaps(ev, window),
  );
  return {
    timed: visible.filter((ev) => !ev.allDay).sort(compareEvents),
    allDay: visible.filter((ev) => ev.allDay).sort(compareEvents),
  };
}

export function eventStatus(ev: CalendarEvent, now: number): EventStatus {
  if (ev.end <= now) return 'past';
  if (ev.start <= now) return 'running';
  return 'upcoming';
}

/** Alle gerade laufenden Termine, der zuerst endende zuerst */
export function runningEvents(timed: readonly CalendarEvent[], now: number): CalendarEvent[] {
  return timed
    .filter((ev) => ev.start <= now && ev.end > now)
    .sort((a, b) => a.end - b.end || a.start - b.start);
}

/** Nächster noch nicht begonnener Termin */
export function nextEvent(timed: readonly CalendarEvent[], now: number): CalendarEvent | null {
  return timed.find((ev) => ev.start > now) ?? null;
}

/** Anzahl Termine, die heute noch beginnen («Noch heute») */
export function remainingCount(timed: readonly CalendarEvent[], now: number): number {
  return timed.filter((ev) => ev.start > now).length;
}

/** «3 Termine», «1 Termin», «keine» */
export function formatRemaining(count: number): string {
  if (count === 0) return 'keine';
  return count === 1 ? '1 Termin' : `${count} Termine`;
}

/**
 * Termin, zu dem die Tagesleiste beim Öffnen scrollt und den das Detailraster
 * standardmässig zeigt: der laufende (zuerst endende), sonst der nächste,
 * sonst der letzte des Tages.
 */
export function focusEvent(timed: readonly CalendarEvent[], now: number): CalendarEvent | null {
  const running = runningEvents(timed, now);
  if (running[0]) return running[0];
  const next = nextEvent(timed, now);
  if (next) return next;
  return timed[timed.length - 1] ?? null;
}

/** Kurze Termine bleiben neben einem sehr langen sichtbar */
export const MIN_BAR_RATIO = 0.15;

/** Längste Dauer des Tages; Bezugsgrösse für die Balken der Tagesleiste */
export function longestDuration(timed: readonly CalendarEvent[]): number {
  return timed.reduce((max, ev) => Math.max(max, ev.end - ev.start), 0);
}

/** Anteil der Balkenbreite (0–1), bezogen auf den längsten Termin des Tages */
export function barRatio(durationMs: number, longestMs: number): number {
  if (!(longestMs > 0) || !(durationMs > 0)) return MIN_BAR_RATIO;
  return Math.min(1, Math.max(MIN_BAR_RATIO, durationMs / longestMs));
}

/** Icon-Art einer Zeile in der Tagesleiste (7.3) */
export type EventIcon = 'video' | 'pin' | 'dot';

export function eventIcon(ev: CalendarEvent): EventIcon {
  if (ev.onlineUrl) return 'video';
  if (ev.location && ev.location.trim().length > 0) return 'pin';
  return 'dot';
}
