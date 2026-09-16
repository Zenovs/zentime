import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dayWindow } from '../src/logic/day';
import { eventsForDay } from '../src/logic/timeline';
import {
  calendarViewUrl,
  fetchAllPages,
  fetchCalendars,
  graphTimeToMillis,
  mapGraphEvent,
  type GraphCalendarRaw,
  type GraphEventRaw,
  type GraphPage,
} from '../src/sources/graph';
import { ZONE, at, hhmm } from './helpers';

const fixture = <T>(name: string): T => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as T;
const ctx = { sourceId: 'ms', calendarName: 'Arbeit', zone: ZONE };

describe('Graph-Mapping', () => {
  const page = fixture<GraphPage<GraphEventRaw>>('graph-calendarview.json');
  const events = page.value.map((r) => mapGraphEvent(r, ctx));
  const byTitle = (t: string) => events.find((e) => e.title === t);

  it('rechnet UTC-Zeiten mit sieben Nachkommastellen in die Systemzeitzone um', () => {
    const standup = byTitle('Standup Team');
    expect(standup && hhmm(standup.start)).toBe('08:30');
    expect(standup && hhmm(standup.end)).toBe('09:00');
  });

  it('übernimmt Online-Meeting, Ort und Web-Link', () => {
    const standup = byTitle('Standup Team');
    expect(standup?.onlineUrl).toContain('teams.microsoft.com/l/meetup-join');
    expect(standup?.location).toBe('Microsoft Teams-Besprechung');
    expect(standup?.webLink).toContain('outlook.office365.com');
    expect(standup?.response).toBe('accepted');
    expect(standup?.showAs).toBe('busy');
  });

  it('ganztägige Termine gelten am lokalen Kalendertag', () => {
    const bday = byTitle('Geburtstag Lea');
    expect(bday?.allDay).toBe(true);
    expect(bday?.start).toBe(at('00:00'));
    expect(bday?.end).toBe(at('00:00', '2026-09-17'));
    expect(bday?.location).toBeNull();
  });

  it('markiert privat, abgelehnt und abgesagt', () => {
    expect(byTitle('Arzttermin')?.isPrivate).toBe(true);
    expect(byTitle('Arzttermin')?.showAs).toBe('oof');
    expect(byTitle('Abgelehnte Einladung')?.response).toBe('declined');
    expect(byTitle('Abgesagte Sitzung')?.isCancelled).toBe(true);
    expect(byTitle('Abgesagte Sitzung')?.response).toBe('tentative');
  });

  it('Tagesfilter blendet abgesagt und abgelehnt aus', () => {
    const day = eventsForDay(events, dayWindow(at('12:00'), ZONE), { hideDeclined: true });
    expect(day.timed.map((e) => e.title)).toEqual(['Standup Team', 'Arzttermin']);
    expect(day.allDay.map((e) => e.title)).toEqual(['Geburtstag Lea']);
  });

  it('graphTimeToMillis akzeptiert IANA-Zonen', () => {
    const ms = graphTimeToMillis({ dateTime: '2026-09-16T09:00:00.0000000', timeZone: 'Europe/Zurich' }, false, ZONE);
    expect(ms).toBe(at('09:00'));
  });
});

describe('calendarViewUrl', () => {
  it('baut die URL nach Pflichtenheft 5.1', () => {
    const url = calendarViewUrl('AAMk/Cal 1', dayWindow(at('12:00'), ZONE));
    expect(url).toContain('/me/calendars/AAMk%2FCal%201/calendarView?');
    expect(url).toContain('startDateTime=2026-09-15T22%3A00%3A00Z');
    expect(url).toContain('endDateTime=2026-09-16T22%3A00%3A00Z');
    expect(url).toContain('%24select=id%2Csubject%2Cstart%2Cend%2CisAllDay');
    expect(url).toContain('webLink');
  });
});

describe('Paginierung', () => {
  it('folgt @odata.nextLink bis zum Ende', async () => {
    const pages: Record<string, GraphPage<{ n: number }>> = {
      'u1': { value: [{ n: 1 }, { n: 2 }], '@odata.nextLink': 'u2' },
      'u2': { value: [{ n: 3 }], '@odata.nextLink': 'u3' },
      'u3': { value: [{ n: 4 }] },
    };
    const calls: string[] = [];
    const fetchJson = async <T>(url: string): Promise<T> => {
      calls.push(url);
      return pages[url] as unknown as T;
    };
    const all = await fetchAllPages<{ n: number }>(fetchJson, 'u1');
    expect(all.map((x) => x.n)).toEqual([1, 2, 3, 4]);
    expect(calls).toEqual(['u1', 'u2', 'u3']);
  });

  it('fetchCalendars liefert die Kalenderliste', async () => {
    const list = fixture<GraphPage<GraphCalendarRaw>>('graph-calendars.json');
    const cals = await fetchCalendars(async <T>() => list as unknown as T);
    expect(cals.map((c) => c.name)).toEqual(['Kalender', 'Geburtstage', 'Team Marketing']);
    expect(cals[0]?.isDefaultCalendar).toBe(true);
  });
});
