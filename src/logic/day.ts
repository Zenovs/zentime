import { DateTime } from 'luxon';
import type { TimeWindow } from '../model/event';

/**
 * Tagesfenster [00:00, 00:00 des Folgetags) in der angegebenen Zeitzone.
 * Luxon rechnet an Zeitumstellungstagen korrekt mit 23 bzw. 25 Stunden.
 */
export function dayWindow(nowMs: number, zone: string, offsetDays = 0): TimeWindow {
  const start = DateTime.fromMillis(nowMs, { zone }).startOf('day').plus({ days: offsetDays });
  const end = start.plus({ days: 1 });
  return { start: start.toMillis(), end: end.toMillis() };
}

/** Tagesabstand zu heute; das Tag-Rad kennt keine Grenze */
export type DayOffset = number;

/** Bereich geladener Tage, als Abstand zu heute */
export interface DayRange {
  from: number;
  to: number;
}

/** Bereich, der beim Start geladen wird: gestern bis morgen */
export const INITIAL_DAY_RANGE: DayRange = { from: -1, to: 1 };

/** So viele Tage werden auf einmal dazugeladen, wenn das Rad an den Rand kommt */
export const RANGE_CHUNK = 7;
/** Ab diesem Abstand zum Rand wird nachgeladen, bevor der Tag leer erscheint */
export const RANGE_MARGIN = 1;

/** Deckt der Bereich den Tag mitsamt Sicherheitsabstand ab? */
export function rangeCovers(range: DayRange, offset: number): boolean {
  return offset >= range.from + RANGE_MARGIN && offset <= range.to - RANGE_MARGIN;
}

/**
 * Erweitert den Bereich so, dass der Tag samt Abstand darin liegt — nur auf der
 * Seite, an der es nötig ist. Wer vorwärts blättert, lädt keine Vergangenheit.
 */
export function growRange(range: DayRange, offset: number): DayRange {
  if (rangeCovers(range, offset)) return range;
  return {
    from: offset < range.from + RANGE_MARGIN ? offset - RANGE_CHUNK : range.from,
    to: offset > range.to - RANGE_MARGIN ? offset + RANGE_CHUNK : range.to,
  };
}

/**
 * Abruffenster über den geladenen Tagesbereich (Pflichtenheft 5.1 / 5.2).
 * Es wächst mit, sobald im Tag-Rad weiter geblättert wird.
 */
export function fetchWindow(nowMs: number, zone: string, range: DayRange = INITIAL_DAY_RANGE): TimeWindow {
  return { start: dayWindow(nowMs, zone, range.from).start, end: dayWindow(nowMs, zone, range.to).end };
}

/** «Gestern» / «Heute» / «Morgen», weiter weg der Wochentag */
export function dayTitle(offset: DayOffset, nowMs: number, zone: string): string {
  const named: Record<number, string> = { [-2]: 'Vorgestern', [-1]: 'Gestern', 0: 'Heute', 1: 'Morgen', 2: 'Übermorgen' };
  return (
    named[offset] ??
    DateTime.fromMillis(nowMs, { zone }).plus({ days: offset }).setLocale('de-CH').toFormat('cccc')
  );
}

/** Beschriftung einer Radposition: Wochentag und Tageszahl, z. B. «Di» / «15» */
export function dayLabel(nowMs: number, zone: string, offsetDays: number): { weekday: string; day: string } {
  const d = DateTime.fromMillis(nowMs, { zone }).plus({ days: offsetDays }).setLocale('de-CH');
  return { weekday: d.toFormat('ccc'), day: d.toFormat('d') };
}

/** Kalendertag als `YYYY-MM-DD`, dient als Schlüssel für den Tageswechsel */
export function dayKey(nowMs: number, zone: string): string {
  return DateTime.fromMillis(nowMs, { zone }).toISODate() ?? '';
}

/** Nächste volle Minute nach `nowMs` (für den minütlichen Hero-Timer) */
export function msUntilNextMinute(nowMs: number): number {
  const rest = nowMs % 60_000;
  return rest === 0 ? 60_000 : 60_000 - rest;
}

/** «Mittwoch, 16. September» */
export function formatLongDate(nowMs: number, zone: string): string {
  return DateTime.fromMillis(nowMs, { zone }).setLocale('de-CH').toFormat("cccc, d. LLLL");
}

/** «14:30» */
export function formatTime(ms: number, zone: string): string {
  return DateTime.fromMillis(ms, { zone }).toFormat('HH:mm');
}

/** «45′», «1 h», «1 h 30′» */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}′`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m}′`;
}

/** «10:00–11:00» */
export function formatRange(start: number, end: number, zone: string): string {
  return `${formatTime(start, zone)}–${formatTime(end, zone)}`;
}
