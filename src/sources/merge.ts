import type { CalendarEvent } from '../model/event';
import { compareEvents } from '../logic/timeline';

/**
 * Führt die Termine aller Quellen zusammen (F-01): nach Beginn sortiert,
 * Duplikate (gleiche `id`) entfernt. Die Quellen liefern bereits das
 * gemeinsame Modell; hier passiert keine Interpretation.
 */
export function mergeEvents(perSource: ReadonlyArray<readonly CalendarEvent[]>): CalendarEvent[] {
  const seen = new Set<string>();
  const out: CalendarEvent[] = [];
  for (const list of perSource) {
    for (const ev of list) {
      if (seen.has(ev.id)) continue;
      seen.add(ev.id);
      out.push(ev);
    }
  }
  return out.sort(compareEvents);
}
