import type { CalendarEvent, TimeWindow } from '../model/event';

export interface Gap {
  start: number;
  /** `null`, wenn die Lücke bis zum Tagesende offen ist («ab 17:30») */
  end: number | null;
}

/** Lücken unter dieser Länge gelten nicht als Lücke */
const MIN_GAP_MS = 5 * 60_000;

/** Vereinigt überlappende Belegungen zu disjunkten, sortierten Intervallen */
export function mergeBusy(timed: readonly CalendarEvent[]): TimeWindow[] {
  const sorted = [...timed].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: TimeWindow[] = [];
  for (const ev of sorted) {
    const last = out[out.length - 1];
    if (last && ev.start <= last.end) {
      last.end = Math.max(last.end, ev.end);
    } else {
      out.push({ start: ev.start, end: ev.end });
    }
  }
  return out;
}

/**
 * Nächste freie Lücke ab `from` innerhalb des Tagesfensters.
 *
 * Für das Detailraster ist `from` das Ende des ausgewählten Termins; ohne
 * Auswahl «jetzt». Die Lücke vor dem ersten Termin, zwischen Terminen und nach
 * dem letzten Termin werden gleich behandelt.
 */
export function nextGap(timed: readonly CalendarEvent[], from: number, day: TimeWindow): Gap | null {
  const busy = mergeBusy(timed);
  let cursor = Math.max(from, day.start);
  if (cursor >= day.end) return null;

  for (const b of busy) {
    if (b.end <= cursor) continue;
    if (b.start > cursor) {
      if (b.start - cursor >= MIN_GAP_MS) return { start: cursor, end: b.start };
      cursor = b.end;
      continue;
    }
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < day.end && day.end - cursor >= MIN_GAP_MS) return { start: cursor, end: null };
  return null;
}
