import { describe, expect, it } from 'vitest';
import { INITIAL_DAY_RANGE, dayWindow, dayTitle, fetchWindow, growRange, rangeCovers } from '../src/logic/day';
import { computeDayHero } from '../src/logic/hero';
import { DETENT, detented, settleOffset } from '../src/logic/wheel';
import { ZONE, at, ev } from './helpers';

const CELL = 100;

describe('Rastmechanik', () => {
  it('rastet auf jeder Position ein', () => {
    expect(detented(0, CELL)).toBe(0);
    expect(detented(CELL, CELL)).toBeCloseTo(CELL);
    expect(detented(-CELL, CELL)).toBeCloseTo(-CELL);
  });

  it('hält nahe einer Raste fest: das Rad folgt dem Finger nur gedämpft', () => {
    const near = detented(10, CELL);
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(10);
  });

  it('läuft zur Mitte zwischen zwei Rasten wieder mit dem Finger gleich', () => {
    expect(detented(CELL / 2, CELL)).toBeCloseTo(CELL / 2);
  });

  it('ist punktsymmetrisch, vorwärts wie rückwärts gleich', () => {
    expect(detented(-30, CELL)).toBeCloseTo(-detented(30, CELL));
  });

  it('DETENT über 1 ist die Bedingung für die Dämpfung', () => {
    expect(DETENT).toBeGreaterThan(1);
  });

  it('verträgt eine noch nicht gemessene Breite', () => {
    expect(detented(42, 0)).toBe(42);
    expect(settleOffset(42, 0, 0, 3)).toBe(3);
  });
});

describe('Einrasten beim Loslassen', () => {
  it('bleibt bei kurzem Zupfen auf dem Tag', () => {
    expect(settleOffset(12, 0, CELL, 0)).toBe(0);
  });

  it('wechselt bei mehr als einer halben Rasterbreite', () => {
    expect(settleOffset(60, 0, CELL, 0)).toBe(-1);
    expect(settleOffset(-60, 0, CELL, 0)).toBe(1);
  });

  it('ein Stups mit Schwung genügt', () => {
    expect(settleOffset(10, 0, CELL, 0)).toBe(0);
    expect(settleOffset(10, 1.2, CELL, 0)).toBe(-1);
  });

  it('trägt bei kräftigem Wisch über mehrere Tage', () => {
    expect(settleOffset(-250, -4, CELL, 0)).toBe(6);
  });

  it('dreht in beide Richtungen unbegrenzt weiter', () => {
    expect(settleOffset(-CELL, 0, CELL, 40)).toBe(41);
    expect(settleOffset(CELL, 0, CELL, -40)).toBe(-41);
  });
});

describe('Geladener Tagesbereich', () => {
  it('deckt anfangs nur heute ab, nicht dessen Nachbarn', () => {
    expect(rangeCovers(INITIAL_DAY_RANGE, 0)).toBe(true);
    expect(rangeCovers(INITIAL_DAY_RANGE, 1)).toBe(false);
  });

  it('wächst über den verlangten Tag hinaus, damit nicht bei jedem Schritt nachgeladen wird', () => {
    const grown = growRange(INITIAL_DAY_RANGE, 2);
    expect(grown.to).toBeGreaterThan(2);
    expect(rangeCovers(grown, 2)).toBe(true);
    expect(grown.from).toBe(INITIAL_DAY_RANGE.from);
  });

  it('wächst auch rückwärts und behält das bereits Geladene', () => {
    const grown = growRange({ from: -1, to: 20 }, -5);
    expect(grown.from).toBeLessThan(-5);
    expect(grown.to).toBe(20);
  });

  it('lässt einen abgedeckten Tag unverändert', () => {
    const range = { from: -10, to: 10 };
    expect(growRange(range, 0)).toBe(range);
  });
});

describe('Abruffenster deckt das Rad ab', () => {
  it('folgt dem geladenen Bereich', () => {
    const now = at('12:00');
    const w = fetchWindow(now, ZONE, { from: -3, to: 4 });
    expect(w.start).toBe(dayWindow(now, ZONE, -3).start);
    expect(w.end).toBe(dayWindow(now, ZONE, 4).end);
    expect(w.end - w.start).toBe(8 * 24 * 3600_000);
  });

  it('benennt nahe Tage, weiter weg den Wochentag', () => {
    const now = at('12:00');
    expect(dayTitle(-1, now, ZONE)).toBe('Gestern');
    expect(dayTitle(0, now, ZONE)).toBe('Heute');
    expect(dayTitle(1, now, ZONE)).toBe('Morgen');
    expect(dayTitle(2, now, ZONE)).toBe('Übermorgen');
    // 2026-09-16 ist ein Mittwoch, sieben Tage später wieder
    expect(dayTitle(7, now, ZONE)).toBe('Mittwoch');
  });
});

describe('Hero für andere Tage', () => {
  it('zeigt Beginn und Anzahl statt eines Countdowns', () => {
    const hero = computeDayHero({ timed: [ev('A', '08:00', '09:00'), ev('B', '10:00', '11:00')], allDay: [], zone: ZONE });
    expect(hero.kind).toBe('day');
    expect(hero.big).toBe('08:00');
    expect(hero.unit).toBeNull();
    expect(hero.muted).toBe('2 Termine · ');
    expect(hero.text).toBe('A');
  });

  it('nennt den Titel ohne Anzahl, wenn es nur einen Termin gibt', () => {
    const hero = computeDayHero({ timed: [ev('A', '08:00', '09:00')], allDay: [], zone: ZONE });
    expect(hero.muted).toBe('');
  });

  it('meldet einen leeren Tag als frei', () => {
    const hero = computeDayHero({ timed: [], allDay: [], zone: ZONE });
    expect(hero.big).toBe('frei');
    expect(hero.text).toBe('Keine Termine');
    expect(hero.eventId).toBeNull();
  });

  it('behauptet nicht «keine Termine», solange der Tag noch nicht abgerufen ist', () => {
    const hero = computeDayHero({ timed: [], allDay: [], zone: ZONE, loaded: false });
    expect(hero.text).toBe('Wird geladen …');
  });
});
