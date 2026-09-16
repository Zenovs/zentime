import { describe, expect, it } from 'vitest';
import { dayWindow } from '../src/logic/day';
import {
  MIN_BAR_RATIO,
  barRatio,
  eventIcon,
  eventStatus,
  eventsForDay,
  focusEvent,
  formatRemaining,
  longestDuration,
  remainingCount,
  runningEvents,
} from '../src/logic/timeline';
import { mergeEvents } from '../src/sources/merge';
import { ZONE, allDay, at, ev } from './helpers';

const today = dayWindow(at('12:00'), ZONE);

describe('eventsForDay', () => {
  it('blendet abgesagte immer und abgelehnte je nach Einstellung aus', () => {
    const events = [
      ev('Normal', '09:00', '10:00'),
      ev('Abgesagt', '10:00', '11:00', { isCancelled: true }),
      ev('Abgelehnt', '11:00', '12:00', { response: 'declined' }),
      ev('Vorbehalt', '12:00', '13:00', { response: 'tentative' }),
    ];
    const hidden = eventsForDay(events, today, { hideDeclined: true });
    expect(hidden.timed.map((e) => e.title)).toEqual(['Normal', 'Vorbehalt']);
    const shown = eventsForDay(events, today, { hideDeclined: false });
    expect(shown.timed.map((e) => e.title)).toEqual(['Normal', 'Abgelehnt', 'Vorbehalt']);
  });

  it('zeigt Termine über Mitternacht an beiden Tagen', () => {
    const night = ev('Nachtschicht', '23:00', '01:00', { endDay: '2026-09-17' });
    expect(eventsForDay([night], today, { hideDeclined: true }).timed).toHaveLength(1);
    const tomorrow = dayWindow(at('12:00', '2026-09-17'), ZONE);
    expect(eventsForDay([night], tomorrow, { hideDeclined: true }).timed).toHaveLength(1);
    const dayAfter = dayWindow(at('12:00', '2026-09-18'), ZONE);
    expect(eventsForDay([night], dayAfter, { hideDeclined: true }).timed).toHaveLength(0);
  });

  it('trennt ganztägige und mehrtägige Termine ab, die heute betreffen', () => {
    const events = [
      allDay('Geburtstag', '2026-09-16'),
      allDay('Weiterbildung', '2026-09-15', 3),
      allDay('Gestern', '2026-09-15'),
      allDay('Morgen', '2026-09-17'),
      ev('Sitzung', '09:00', '10:00'),
    ];
    const d = eventsForDay(events, today, { hideDeclined: true });
    expect(d.allDay.map((e) => e.title)).toEqual(['Weiterbildung', 'Geburtstag']);
    expect(d.timed.map((e) => e.title)).toEqual(['Sitzung']);
  });

  it('sortiert nach Beginn, dann Ende', () => {
    const d = eventsForDay(
      [ev('B', '10:00', '11:00'), ev('A', '09:00', '09:30'), ev('C', '10:00', '10:30')],
      today,
      { hideDeclined: true },
    );
    expect(d.timed.map((e) => e.title)).toEqual(['A', 'C', 'B']);
  });

  it('leerer Tag', () => {
    const d = eventsForDay([ev('Gestern', '09:00', '10:00', { day: '2026-09-15' })], today, { hideDeclined: true });
    expect(d.timed).toEqual([]);
    expect(d.allDay).toEqual([]);
  });
});

describe('Status und Auswahl', () => {
  const timed = [ev('A', '08:30', '09:00'), ev('B', '09:15', '10:00'), ev('C', '11:00', '12:30')];

  it('eventStatus', () => {
    expect(eventStatus(timed[0]!, at('09:35'))).toBe('past');
    expect(eventStatus(timed[1]!, at('09:35'))).toBe('running');
    expect(eventStatus(timed[2]!, at('09:35'))).toBe('upcoming');
  });

  it('runningEvents sortiert nach Ende', () => {
    const overlapping = [ev('Lang', '14:30', '15:30'), ev('Kurz', '14:45', '15:00')];
    expect(runningEvents(overlapping, at('14:48')).map((e) => e.title)).toEqual(['Kurz', 'Lang']);
  });

  it('remainingCount und formatRemaining', () => {
    expect(remainingCount(timed, at('09:35'))).toBe(1);
    expect(formatRemaining(0)).toBe('keine');
    expect(formatRemaining(1)).toBe('1 Termin');
    expect(formatRemaining(3)).toBe('3 Termine');
  });

  it('focusEvent: laufend, sonst nächster, sonst letzter', () => {
    expect(focusEvent(timed, at('09:35'))?.title).toBe('B');
    expect(focusEvent(timed, at('10:30'))?.title).toBe('C');
    expect(focusEvent(timed, at('13:00'))?.title).toBe('C');
    expect(focusEvent([], at('13:00'))).toBeNull();
  });

  it('eventIcon: Video, Pin, sonst Punkt', () => {
    expect(eventIcon(ev('X', '09:00', '10:00', { onlineUrl: 'https://meet.google.com/x' }))).toBe('video');
    expect(eventIcon(ev('X', '09:00', '10:00', { location: 'Bern' }))).toBe('pin');
    expect(eventIcon(ev('X', '09:00', '10:00', { location: '  ' }))).toBe('dot');
  });
});

describe('Dauer-Balken', () => {
  const timed = [ev('Kurz', '08:00', '08:15'), ev('Mittel', '09:00', '10:00'), ev('Lang', '13:00', '17:00')];

  it('longestDuration nimmt den längsten Termin des Tages', () => {
    expect(longestDuration(timed)).toBe(4 * 3600_000);
    expect(longestDuration([])).toBe(0);
  });

  it('barRatio ist proportional zur Dauer', () => {
    const longest = longestDuration(timed);
    expect(barRatio(4 * 3600_000, longest)).toBe(1);
    expect(barRatio(2 * 3600_000, longest)).toBe(0.5);
  });

  it('sehr kurze Termine behalten eine sichtbare Mindestbreite', () => {
    expect(barRatio(60_000, 4 * 3600_000)).toBe(MIN_BAR_RATIO);
  });

  it('fängt fehlende Bezugsgrösse und Termine ohne Dauer ab', () => {
    expect(barRatio(3600_000, 0)).toBe(MIN_BAR_RATIO);
    expect(barRatio(0, 3600_000)).toBe(MIN_BAR_RATIO);
  });
});

describe('mergeEvents', () => {
  it('führt Quellen zusammen, sortiert und entfernt Duplikate', () => {
    const a = ev('A', '10:00', '11:00');
    const b = ev('B', '09:00', '09:30');
    const merged = mergeEvents([[a], [b, { ...a }]]);
    expect(merged.map((e) => e.title)).toEqual(['B', 'A']);
  });
});
