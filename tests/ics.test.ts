import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { dayWindow, fetchWindow } from '../src/logic/day';
import { eventsForDay } from '../src/logic/timeline';
import { parseIcs } from '../src/sources/ics';
import { ZONE, at, hhmm } from './helpers';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const ctx = { sourceId: 'g', calendarName: 'Privat', zone: ZONE };

describe('Google-ICS mit Wiederholungen', () => {
  const window = dayWindow(at('12:00'), ZONE);
  const events = parseIcs(fixture('google-recurring.ics'), window, ctx);
  const byTitle = (t: string) => events.find((e) => e.title === t);

  it('liefert genau die Termine, die heute betreffen', () => {
    expect(events.map((e) => e.title).sort()).toEqual(
      [
        'Fokuszeit',
        'Geburtstag Lea',
        'Jour fixe (nachgeholt)',
        'Kickoff',
        'Nachtschicht',
        'Review Kampagne',
        'Standup',
        'Therapie',
        'Weiterbildung',
        'Wochenplanung (verschoben)',
        'Zahnarzt',
      ].sort(),
    );
  });

  it('expandiert die tägliche Serie und respektiert EXDATE', () => {
    const standup = byTitle('Standup');
    expect(standup && hhmm(standup.start)).toBe('08:30');
    // gestern (EXDATE) und morgen (EXDATE) fehlen im Zwei-Tages-Fenster
    const two = parseIcs(fixture('google-recurring.ics'), fetchWindow(at('12:00'), ZONE), ctx);
    expect(two.filter((e) => e.title === 'Standup')).toHaveLength(1);
  });

  it('verschobener Einzeltermin ersetzt die reguläre Wiederholung', () => {
    const moved = byTitle('Wochenplanung (verschoben)');
    expect(moved && hhmm(moved.start)).toBe('09:30');
    expect(moved && hhmm(moved.end)).toBe('10:15');
    expect(byTitle('Wochenplanung')).toBeUndefined();
    expect(moved?.location).toBe('Sitzungszimmer 2');
  });

  it('abgesagter Einzeltermin ist als abgesagt markiert und wird gefiltert', () => {
    const review = byTitle('Review Kampagne');
    expect(review?.isCancelled).toBe(true);
    const day = eventsForDay(events, window, { hideDeclined: true });
    expect(day.timed.find((e) => e.title === 'Review Kampagne')).toBeUndefined();
  });

  it('in den Tag verschobener Termin einer abgelaufenen Serie erscheint', () => {
    const jf = byTitle('Jour fixe (nachgeholt)');
    expect(jf && hhmm(jf.start)).toBe('10:45');
  });

  it('ganztägige und mehrtägige Termine gelten lokal', () => {
    const bday = byTitle('Geburtstag Lea');
    expect(bday?.allDay).toBe(true);
    expect(bday?.start).toBe(at('00:00'));
    expect(bday?.end).toBe(at('00:00', '2026-09-17'));
    expect(bday?.showAs).toBe('free');
    const wb = byTitle('Weiterbildung');
    expect(wb?.start).toBe(at('00:00', '2026-09-15'));
    expect(wb?.end).toBe(at('00:00', '2026-09-18'));
    expect(wb?.location).toBe('Bern');
  });

  it('UTC-Zeiten und Termine über Mitternacht', () => {
    const night = byTitle('Nachtschicht');
    expect(night && hhmm(night.start)).toBe('23:00');
    expect(night && DateTime.fromMillis(night.end, { zone: ZONE }).toISO()).toContain('2026-09-17T01:00');
  });

  it('Zeiten ohne Zone gelten in der Systemzeitzone', () => {
    const dentist = byTitle('Zahnarzt');
    expect(dentist && hhmm(dentist.start)).toBe('16:00');
  });

  it('erkennt Meeting-Links, private Termine und Transparenz', () => {
    expect(byTitle('Kickoff')?.onlineUrl).toBe('https://meet.google.com/abc-defg-hij');
    expect(byTitle('Therapie')?.isPrivate).toBe(true);
    expect(byTitle('Fokuszeit')?.showAs).toBe('free');
    expect(byTitle('Standup')?.showAs).toBe('busy');
  });

  it('vergibt stabile, eindeutige IDs', () => {
    const ids = events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith('g:'))).toBe(true);
  });
});

describe('Outlook-ICS mit Windows-Zeitzone und Zeitumstellung', () => {
  const text = fixture('outlook-windows-tz.ics');
  const arbeit = { sourceId: 'o', calendarName: 'Arbeit', zone: ZONE };

  it('25. Oktober 2026: 09:30 nach der Umstellung ist 08:30 UTC', () => {
    const w = dayWindow(at('12:00', '2026-10-25'), ZONE);
    const ev = parseIcs(text, w, arbeit).find((e) => e.title === 'Nach der Umstellung');
    expect(ev?.start).toBe(DateTime.fromISO('2026-10-25T09:30', { zone: ZONE }).toMillis());
    expect(ev?.start).toBe(Date.UTC(2026, 9, 25, 8, 30));
  });

  it('28. März 2027: 09:30 nach Beginn der Sommerzeit ist 07:30 UTC', () => {
    const w = dayWindow(at('12:00', '2027-03-28'), ZONE);
    const ev = parseIcs(text, w, arbeit).find((e) => e.title === 'Sommerzeit beginnt');
    expect(ev?.start).toBe(Date.UTC(2027, 2, 28, 7, 30));
  });

  it('wöchentliche Serie behält die lokale Uhrzeit über die Umstellung', () => {
    const before = parseIcs(text, dayWindow(at('12:00', '2026-09-14'), ZONE), arbeit).find((e) => e.title === 'Montagsrunde');
    const after = parseIcs(text, dayWindow(at('12:00', '2026-10-26'), ZONE), arbeit).find((e) => e.title === 'Montagsrunde');
    expect(before && hhmm(before.start)).toBe('17:00');
    expect(after && hhmm(after.start)).toBe('17:00');
    expect(before?.start).toBe(Date.UTC(2026, 8, 14, 15, 0));
    expect(after?.start).toBe(Date.UTC(2026, 9, 26, 16, 0));
  });
});

describe('Planbar-Wochenplan-Feed', () => {
  const events = parseIcs(fixture('planbar.ics'), dayWindow(at('12:00'), ZONE), {
    sourceId: 'p',
    calendarName: 'Planbar',
    zone: ZONE,
  });

  it('entfernt das Dauer-Suffix im Titel und übernimmt den Ticket-Link', () => {
    expect(events.map((e) => e.title)).toEqual(['Layout Herbstkampagne', 'Korrektorat']);
    expect(events[0]?.webLink).toBe('https://planbar.example/tickets/t1');
    expect(events[0]?.onlineUrl).toBeNull();
    expect(events[0] && hhmm(events[0].start)).toBe('09:15');
    expect(events[0] && hhmm(events[0].end)).toBe('11:15');
  });
});
