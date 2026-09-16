import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { dayKey, dayWindow, fetchWindow, formatDuration, formatLongDate, formatRange, msUntilNextMinute } from '../src/logic/day';
import { ZONE, at } from './helpers';

const HOUR = 3_600_000;

describe('dayWindow', () => {
  it('umfasst einen normalen Tag mit 24 Stunden', () => {
    const w = dayWindow(at('09:35'), ZONE);
    expect(w.start).toBe(at('00:00'));
    expect(w.end).toBe(at('00:00', '2026-09-17'));
    expect(w.end - w.start).toBe(24 * HOUR);
  });

  it('hat am 25. Oktober 2026 (Ende Sommerzeit) 25 Stunden', () => {
    const w = dayWindow(at('12:00', '2026-10-25'), ZONE);
    expect(w.end - w.start).toBe(25 * HOUR);
    expect(DateTime.fromMillis(w.end, { zone: ZONE }).toISO()).toContain('2026-10-26T00:00:00');
  });

  it('hat am 28. März 2027 (Beginn Sommerzeit) 23 Stunden', () => {
    const w = dayWindow(at('12:00', '2027-03-28'), ZONE);
    expect(w.end - w.start).toBe(23 * HOUR);
  });

  it('liefert mit Offset den Folgetag', () => {
    const w = dayWindow(at('23:59'), ZONE, 1);
    expect(w.start).toBe(at('00:00', '2026-09-17'));
  });
});

describe('fetchWindow', () => {
  it('reicht von heute 00:00 bis übermorgen 00:00', () => {
    const w = fetchWindow(at('15:00'), ZONE);
    expect(w.start).toBe(at('00:00'));
    expect(w.end).toBe(at('00:00', '2026-09-18'));
  });
});

describe('dayKey', () => {
  it('wechselt um Mitternacht', () => {
    expect(dayKey(at('23:59'), ZONE)).toBe('2026-09-16');
    expect(dayKey(at('00:00', '2026-09-17'), ZONE)).toBe('2026-09-17');
  });
});

describe('Formatierung', () => {
  it('formatDuration', () => {
    expect(formatDuration(45 * 60_000)).toBe('45′');
    expect(formatDuration(60 * 60_000)).toBe('1 h');
    expect(formatDuration(90 * 60_000)).toBe('1 h 30′');
    expect(formatDuration(0)).toBe('0′');
  });

  it('formatRange und formatLongDate', () => {
    expect(formatRange(at('10:00'), at('11:00'), ZONE)).toBe('10:00–11:00');
    expect(formatLongDate(at('10:00'), ZONE)).toBe('Mittwoch, 16. September');
  });

  it('msUntilNextMinute richtet auf die volle Minute aus', () => {
    expect(msUntilNextMinute(at('09:35'))).toBe(60_000);
    expect(msUntilNextMinute(at('09:35') + 15_000)).toBe(45_000);
  });
});
