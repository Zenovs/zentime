import { describe, expect, it } from 'vitest';
import { computeHero } from '../src/logic/hero';
import type { CalendarEvent } from '../src/model/event';
import { ZONE, allDay, at, ev } from './helpers';

const day: CalendarEvent[] = [
  ev('Standup Team', '08:30', '09:00'),
  ev('Wochenplanung', '09:15', '10:00'),
  ev('Kundengespräch Muster AG', '11:00', '12:30'),
  ev('Review Kampagne Herbst', '14:30', '15:30'),
  ev('1:1 mit Lea', '16:00', '16:45'),
];

function hero(now: string, timed = day, extra: { allDay?: CalendarEvent[]; tomorrow?: CalendarEvent[] } = {}) {
  return computeHero({
    timed,
    allDay: extra.allDay ?? [],
    tomorrowTimed: extra.tomorrow ?? [],
    now: at(now),
    zone: ZONE,
  });
}

describe('Hero-Logik (7.2)', () => {
  it('Termin läuft: Restzeit und «läuft · Titel»', () => {
    const h = hero('09:35');
    expect(h).toMatchObject({ kind: 'running', big: '25', unit: 'min', muted: 'läuft · ', text: 'Wochenplanung' });
    expect(h.eventId).toBe(day[1]?.id);
  });

  it('Restzeit wird auf die nächste volle Minute aufgerundet', () => {
    const h = computeHero({ timed: day, allDay: [], tomorrowTimed: [], now: at('09:35') + 30_000, zone: ZONE });
    expect(h.big).toBe('25');
  });

  it('Restzeit über einer Stunde als h:mm', () => {
    const h = hero('11:05');
    expect(h).toMatchObject({ kind: 'running', big: '1:25', unit: 'h', text: 'Kundengespräch Muster AG' });
  });

  it('Nächster Termin in ≤ 60 min: Minuten und «bis Titel»', () => {
    const h = hero('10:18');
    expect(h).toMatchObject({ kind: 'soon', big: '42', unit: 'min', muted: 'bis ', text: 'Kundengespräch Muster AG' });
  });

  it('genau 60 Minuten zählen noch als «bald»', () => {
    expect(hero('10:00').kind).toBe('soon');
    expect(hero('10:00').big).toBe('60');
  });

  it('Nächster Termin in > 60 min: Startzeit und Titel', () => {
    const h = hero('12:45');
    expect(h).toMatchObject({ kind: 'later', big: '14:30', unit: null, muted: '', text: 'Review Kampagne Herbst' });
  });

  it('Mehrere Termine laufen: der zuerst endende zählt, «+1»', () => {
    const timed = [...day, ev('Abstimmung Layout', '14:45', '15:00')];
    const h = hero('14:48', timed);
    expect(h).toMatchObject({ kind: 'running', big: '12', unit: 'min', text: 'Abstimmung Layout +1' });
  });

  it('Heute nichts mehr, morgen etwas: «frei» und Morgen-Vorschau', () => {
    const tomorrow = [ev('Teamsitzung', '08:00', '09:00', { day: '2026-09-17' })];
    const h = hero('17:50', day, { tomorrow });
    expect(h).toMatchObject({ kind: 'tomorrow', big: 'frei', unit: null, muted: 'Morgen 08:00 · ', text: 'Teamsitzung' });
  });

  it('Heute nichts mehr und morgen nichts: «Heute nichts mehr»', () => {
    const h = hero('17:50');
    expect(h).toMatchObject({ kind: 'done', big: 'frei', text: 'Heute nichts mehr' });
  });

  it('Heute gar keine Termine', () => {
    const h = hero('10:00', []);
    expect(h).toMatchObject({ kind: 'none', big: 'frei', text: 'Heute keine Termine', eventId: null });
  });

  it('Nur ganztägige Termine: Titel des ganztägigen Termins', () => {
    const h = hero('10:00', [], { allDay: [allDay('Weiterbildung UX')] });
    expect(h).toMatchObject({ kind: 'allDayOnly', big: 'frei', text: 'Weiterbildung UX' });
  });

  it('Ganztägige Termine lösen den Hero nie aus', () => {
    const h = hero('09:35', day, { allDay: [allDay('Geburtstag Lea')] });
    expect(h.kind).toBe('running');
  });

  it('Private Termine zeigen «Privat»', () => {
    const h = hero('16:10', [ev('Therapie', '16:00', '16:45', { isPrivate: true })]);
    expect(h.text).toBe('Privat');
  });

  it('Termin über Mitternacht läuft am Folgetag weiter', () => {
    const night = ev('Nachtschicht', '23:00', '01:00', { endDay: '2026-09-17' });
    const h = computeHero({ timed: [night], allDay: [], tomorrowTimed: [], now: at('00:30', '2026-09-17'), zone: ZONE });
    expect(h).toMatchObject({ kind: 'running', big: '30', unit: 'min' });
  });
});
