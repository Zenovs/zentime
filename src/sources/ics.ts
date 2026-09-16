import ICAL from 'ical.js';
import { DateTime, IANAZone } from 'luxon';
import type { CalendarEvent, ShowAs, TimeWindow } from '../model/event';
import { overlaps } from '../model/event';

export interface IcsContext {
  sourceId: string;
  calendarName: string;
  /** Systemzeitzone: gilt für DATE-Werte und Zeiten ohne Zone («floating») */
  zone: string;
}

/** Wie weit über das Fenster hinaus iteriert wird, um verschobene Einzeltermine zu erfassen */
const LOOKAHEAD_MS = 7 * 24 * 60 * 60_000;
/** Schutz gegen endlose Wiederholungsregeln */
const MAX_ITERATIONS = 20_000;

const MEETING_URL =
  /https?:\/\/(?:[\w.-]+\.)?(?:teams\.microsoft\.com\/l\/meetup-join|teams\.live\.com\/meet|meet\.google\.com|zoom\.us\/[jw]|[\w-]+\.zoom\.us\/[jw]|webex\.com\/(?:meet|join)|[\w-]+\.webex\.com)[^\s<>"')]*/i;

/**
 * Wandelt eine ICAL.Time in Epoch-Millisekunden um.
 *
 * - DATE-Werte gelten in der Systemzeitzone (ganztägig).
 * - Zeiten mit Z oder mit einer VTIMEZONE-Definition aus der Datei rechnet ical.js um.
 * - Zeiten mit IANA-TZID ohne passende VTIMEZONE rechnet Luxon um.
 * - Zeiten ohne Zone gelten in der Systemzeitzone.
 */
export function icalTimeToMillis(t: ICAL.Time, tzidHint: string | null, zone: string): number {
  if (t.isDate) {
    return DateTime.fromObject({ year: t.year, month: t.month, day: t.day }, { zone }).toMillis();
  }
  const tz = t.zone;
  const tzid = tz?.tzid ?? null;
  if (tz === ICAL.Timezone.utcTimezone || tzid === 'UTC' || tzid === 'Z') {
    return t.toUnixTime() * 1000;
  }
  const floating = !tz || tz === ICAL.Timezone.localTimezone || tzid === 'floating';
  if (!floating) {
    return t.toUnixTime() * 1000;
  }
  const iana = tzidHint && IANAZone.isValidZone(tzidHint) ? tzidHint : zone;
  return DateTime.fromObject(
    { year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second },
    { zone: iana },
  ).toMillis();
}

function firstString(comp: ICAL.Component, name: string): string | null {
  const v = comp.getFirstPropertyValue(name);
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function findMeetingUrl(...candidates: Array<string | null>): string | null {
  for (const c of candidates) {
    if (!c) continue;
    const m = MEETING_URL.exec(c);
    if (m) return m[0];
  }
  return null;
}

function showAsFrom(comp: ICAL.Component): ShowAs {
  const status = firstString(comp, 'status')?.toUpperCase();
  if (status === 'TENTATIVE') return 'tentative';
  const transp = firstString(comp, 'transp')?.toUpperCase();
  return transp === 'TRANSPARENT' ? 'free' : 'busy';
}

function stripPlanbarSuffix(title: string): string {
  return title.replace(/\s*\(\d+(?:[.,]\d+)?\s*h\)\s*$/u, '');
}

interface Occurrence {
  item: ICAL.Event;
  start: number;
  end: number;
  allDay: boolean;
  key: string;
}

function buildEvent(o: Occurrence, uid: string, ctx: IcsContext, stripDuration: boolean): CalendarEvent {
  const comp = o.item.component;
  const rawTitle = o.item.summary ?? '';
  const title = stripDuration ? stripPlanbarSuffix(rawTitle) : rawTitle;
  const cls = firstString(comp, 'class')?.toUpperCase();
  const status = firstString(comp, 'status')?.toUpperCase();
  const url = firstString(comp, 'url');
  const conference = firstString(comp, 'x-google-conference');
  const onlineUrl = findMeetingUrl(conference, url, o.item.location, o.item.description);

  return {
    id: `${ctx.sourceId}:${uid}:${o.start}`,
    sourceId: ctx.sourceId,
    calendarName: ctx.calendarName,
    title,
    start: o.start,
    end: o.end,
    allDay: o.allDay,
    location: o.item.location?.trim() || null,
    onlineUrl,
    webLink: url && url !== onlineUrl ? url : null,
    isCancelled: status === 'CANCELLED',
    response: 'none',
    showAs: showAsFrom(comp),
    isPrivate: cls === 'PRIVATE' || cls === 'CONFIDENTIAL',
  };
}

/**
 * Liest einen ICS-Text und liefert alle Termine, die das Fenster berühren.
 * Wiederholungen werden expandiert; EXDATE, RECURRENCE-ID (auch verschobene
 * Einzeltermine) und STATUS:CANCELLED werden berücksichtigt (Pflichtenheft 5.2).
 */
export function parseIcs(text: string, window: TimeWindow, ctx: IcsContext): CalendarEvent[] {
  let root: ICAL.Component;
  try {
    root = new ICAL.Component(ICAL.parse(text));
  } catch {
    // ical.js zitiert in seinen Fehlermeldungen die fehlerhafte Zeile samt Inhalt;
    // die darf weder ins Log noch in die Oberfläche.
    throw new Error('Kalender konnte nicht gelesen werden (ungültiges ICS)');
  }
  const prodId = firstString(root, 'prodid') ?? '';
  const stripDuration = /planbar/i.test(prodId);

  // Zonen gelten nur für diese Datei; ical.js löst TZIDs zuerst im Komponentenbaum auf.
  ICAL.TimezoneService.reset();
  for (const vtz of root.getAllSubcomponents('vtimezone')) {
    try {
      ICAL.TimezoneService.register(vtz);
    } catch {
      // Unvollständige VTIMEZONE: ical.js fällt auf die Zone im Komponentenbaum zurück
    }
  }

  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const comp of root.getAllSubcomponents('vevent')) {
    const ev = new ICAL.Event(comp);
    if (!ev.uid) continue;
    if (ev.isRecurrenceException()) exceptions.push(ev);
    else if (!masters.has(ev.uid)) masters.set(ev.uid, ev);
  }
  for (const ex of exceptions) {
    const master = masters.get(ex.uid);
    if (master) {
      try {
        master.relateException(ex);
      } catch {
        // z. B. Ausnahme zu einer nicht wiederkehrenden Serie: unten als Einzeltermin behandelt
      }
    }
  }

  const out: CalendarEvent[] = [];
  const produced = new Set<string>();
  const horizon = window.end + LOOKAHEAD_MS;

  const push = (o: Occurrence, uid: string) => {
    if (produced.has(o.key)) return;
    produced.add(o.key);
    if (!overlaps(o, window)) return;
    out.push(buildEvent(o, uid, ctx, stripDuration));
  };

  for (const [uid, ev] of masters) {
    const dtstartProp = ev.component.getFirstProperty('dtstart');
    const tzidHint = (dtstartProp?.getParameter('tzid') as string | undefined) ?? null;
    const allDay = ev.startDate.isDate;

    if (!ev.isRecurring()) {
      const start = icalTimeToMillis(ev.startDate, tzidHint, ctx.zone);
      const end = icalTimeToMillis(ev.endDate, tzidHint, ctx.zone);
      push({ item: ev, start, end: Math.max(end, start), allDay, key: `${uid}|${start}` }, uid);
      continue;
    }

    const it = ev.iterator();
    let next: ICAL.Time | null | undefined;
    let n = 0;
    while ((next = it.next()) && n++ < MAX_ITERATIONS) {
      const det = ev.getOccurrenceDetails(next);
      const start = icalTimeToMillis(det.startDate, tzidHint, ctx.zone);
      const end = icalTimeToMillis(det.endDate, tzidHint, ctx.zone);
      const recurrenceStart = icalTimeToMillis(next, tzidHint, ctx.zone);
      if (recurrenceStart >= horizon) break;
      const key = `${uid}|${det.recurrenceId.toString()}`;
      push({ item: det.item, start, end: Math.max(end, start), allDay: det.startDate.isDate, key }, uid);
    }
  }

  // Verschobene Einzeltermine, deren ursprüngliche Wiederholung ausserhalb des
  // iterierten Bereichs liegt oder deren Serie fehlt, direkt prüfen.
  for (const ex of exceptions) {
    const key = `${ex.uid}|${ex.recurrenceId?.toString() ?? ''}`;
    if (produced.has(key)) continue;
    const dtstartProp = ex.component.getFirstProperty('dtstart');
    const tzidHint = (dtstartProp?.getParameter('tzid') as string | undefined) ?? null;
    const start = icalTimeToMillis(ex.startDate, tzidHint, ctx.zone);
    const end = icalTimeToMillis(ex.endDate, tzidHint, ctx.zone);
    push({ item: ex, start, end: Math.max(end, start), allDay: ex.startDate.isDate, key }, ex.uid);
  }

  return out.sort((a, b) => a.start - b.start || a.end - b.end);
}
