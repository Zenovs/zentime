/**
 * Gemeinsames Terminmodell aller Quellen.
 *
 * Zeiten sind Epoch-Millisekunden. Ganztägige Termine beginnen um lokal 00:00
 * des ersten Tages und enden um lokal 00:00 des Tages nach dem letzten Tag
 * (exklusives Ende).
 */

export type ResponseStatus = 'accepted' | 'declined' | 'tentative' | 'organizer' | 'none';

export type ShowAs = 'busy' | 'free' | 'tentative' | 'oof' | 'workingElsewhere' | 'unknown';

export interface CalendarEvent {
  /** Stabiler Schlüssel: `${sourceId}:${uid}:${start}` */
  id: string;
  /** Konfigurierte Quelle, zu der der Termin gehört */
  sourceId: string;
  /** Anzeigename des Kalenders (z. B. «Arbeit») */
  calendarName: string;
  /** Originaltitel. Bei `isPrivate` zeigt die Oberfläche «Privat». */
  title: string;
  start: number;
  end: number;
  allDay: boolean;
  location: string | null;
  /** Beitritts-Link für Online-Meetings (Teams, Meet, Zoom …) */
  onlineUrl: string | null;
  /** Link zum Termin im Web (Graph `webLink`, ICS `URL`) */
  webLink: string | null;
  isCancelled: boolean;
  response: ResponseStatus;
  showAs: ShowAs;
  isPrivate: boolean;
}

/** Halboffenes Zeitfenster [start, end) in Epoch-Millisekunden */
export interface TimeWindow {
  start: number;
  end: number;
}

export function overlaps(ev: { start: number; end: number }, w: TimeWindow): boolean {
  return ev.start < w.end && ev.end > w.start;
}
