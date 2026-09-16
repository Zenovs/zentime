import { describe, expect, it } from 'vitest';
import { resolveTheme, toggledTheme } from '../src/app/theme';
import { formatGap, onlineLabel } from '../src/components/DetailGrid';
import { DEFAULT_SETTINGS, normalizeSettings, sourceColor } from '../src/model/settings';
import { isAllowedIcsUrl, retryAfterMs } from '../src/platform/http';
import { ZONE, at } from './helpers';

describe('HTTP-Hilfen', () => {
  it('retryAfterMs liest Sekunden und Datumsangaben', () => {
    const now = Date.UTC(2026, 8, 16, 10, 0, 0);
    expect(retryAfterMs(new Response(null, { headers: { 'Retry-After': '30' } }), now)).toBe(30_000);
    const date = new Date(now + 90_000).toUTCString();
    expect(retryAfterMs(new Response(null, { headers: { 'Retry-After': date } }), now)).toBe(90_000);
    expect(retryAfterMs(new Response(null), now)).toBeNull();
  });

  it('isAllowedIcsUrl erlaubt nur https und schreibt webcal um', () => {
    expect(isAllowedIcsUrl('webcal://example.com/cal.ics')).toEqual({ ok: true, url: 'https://example.com/cal.ics' });
    expect(isAllowedIcsUrl('http://example.com/cal.ics').ok).toBe(false);
    expect(isAllowedIcsUrl('nicht eine url').ok).toBe(false);
  });
});

describe('Einstellungen', () => {
  it('normalizeSettings ergänzt Standardwerte und verwirft Unbrauchbares', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    const s = normalizeSettings({ theme: 'dark', sources: [{ id: 'a', kind: 'ics', name: 'X' }, null, { foo: 1 }] });
    expect(s.theme).toBe('dark');
    expect(s.hideDeclined).toBe(true);
    expect(s.sources).toHaveLength(1);
  });

  it('sourceColor läuft zyklisch', () => {
    expect(sourceColor(0)).toBe(sourceColor(6));
    expect(sourceColor(-1)).toBe(sourceColor(5));
  });
});

describe('Theme', () => {
  it('folgt dem System oder der manuellen Wahl', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(toggledTheme('dark')).toBe('light');
  });
});

describe('Detailraster-Formatierung', () => {
  it('formatGap', () => {
    expect(formatGap(null, ZONE)).toBe('–');
    expect(formatGap({ start: at('10:00'), end: at('11:00') }, ZONE)).toBe('10:00–11:00');
    expect(formatGap({ start: at('17:30'), end: null }, ZONE)).toBe('ab 17:30');
  });

  it('onlineLabel erkennt Anbieter', () => {
    expect(onlineLabel('https://teams.microsoft.com/l/meetup-join/x')).toBe('Teams');
    expect(onlineLabel('https://meet.google.com/abc')).toBe('Meet');
    expect(onlineLabel('https://firma.zoom.us/j/1')).toBe('Zoom');
    expect(onlineLabel('https://example.com/room')).toBe('Online');
  });
});
