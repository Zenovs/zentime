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

/** Abruffenster: heute 00:00 bis übermorgen 00:00 (Pflichtenheft 5.1 / 5.2) */
export function fetchWindow(nowMs: number, zone: string): TimeWindow {
  const today = dayWindow(nowMs, zone);
  const tomorrow = dayWindow(nowMs, zone, 1);
  return { start: today.start, end: tomorrow.end };
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
