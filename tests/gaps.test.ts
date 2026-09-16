import { describe, expect, it } from 'vitest';
import { mergeBusy, nextGap } from '../src/logic/gaps';
import { dayWindow } from '../src/logic/day';
import { ZONE, at, ev, hhmm } from './helpers';

const day = dayWindow(at('12:00'), ZONE);
const timed = [
  ev('Standup', '08:30', '09:00'),
  ev('Wochenplanung', '09:15', '10:00'),
  ev('Kundengespräch', '11:00', '12:30'),
  ev('Mittagessen', '12:30', '13:15'),
  ev('Review', '14:30', '15:30'),
  ev('Abstimmung', '14:45', '15:00'),
];

describe('nextGap', () => {
  it('vor dem ersten Termin', () => {
    const g = nextGap(timed, at('07:00'), day);
    expect(g && hhmm(g.start)).toBe('07:00');
    expect(g && g.end && hhmm(g.end)).toBe('08:30');
  });

  it('zwischen Terminen, ab Ende des ausgewählten', () => {
    const g = nextGap(timed, at('10:00'), day);
    expect(g && hhmm(g.start)).toBe('10:00');
    expect(g && g.end && hhmm(g.end)).toBe('11:00');
  });

  it('überspringt direkt anschliessende Termine', () => {
    const g = nextGap(timed, at('12:30'), day);
    expect(g && hhmm(g.start)).toBe('13:15');
    expect(g && g.end && hhmm(g.end)).toBe('14:30');
  });

  it('ignoriert überlappende Termine innerhalb einer Belegung', () => {
    const g = nextGap(timed, at('15:00'), day);
    expect(g && hhmm(g.start)).toBe('15:30');
    expect(g?.end).toBeNull();
  });

  it('nach dem letzten Termin bis Tagesende offen', () => {
    const g = nextGap(timed, at('15:30'), day);
    expect(g).toEqual({ start: at('15:30'), end: null });
  });

  it('keine Lücke, wenn der Tag vorbei ist', () => {
    expect(nextGap(timed, at('00:00', '2026-09-17'), day)).toBeNull();
  });

  it('kurze Lücken unter 5 Minuten zählen nicht', () => {
    const tight = [ev('A', '09:00', '10:00'), ev('B', '10:03', '11:00')];
    const g = nextGap(tight, at('09:00'), day);
    expect(g && hhmm(g.start)).toBe('11:00');
  });

  it('leerer Tag: Lücke ab jetzt bis Tagesende', () => {
    expect(nextGap([], at('09:00'), day)).toEqual({ start: at('09:00'), end: null });
  });
});

describe('mergeBusy', () => {
  it('vereinigt überlappende und anschliessende Termine', () => {
    const busy = mergeBusy(timed);
    expect(busy.map((b) => `${hhmm(b.start)}–${hhmm(b.end)}`)).toEqual([
      '08:30–09:00',
      '09:15–10:00',
      '11:00–13:15',
      '14:30–15:30',
    ]);
  });
});
