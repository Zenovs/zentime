import { DateTime } from 'luxon';
import type { CalendarEvent } from '../model/event';
import type { Settings } from '../model/settings';

/**
 * Demo-Daten für `pnpm dev` im Browser (`http://localhost:1420/?demo&now=09:35`).
 * Sie entsprechen dem M0-Mockup und enthalten keine echten Termine.
 */
export function demoSettings(theme: Settings['theme'] = 'system'): Settings {
  return {
    theme,
    alwaysOnTop: false,
    autostart: false,
    hideDeclined: true,
    sources: [
      {
        id: 'demo-ms',
        kind: 'graph',
        name: 'Arbeit',
        clientId: '00000000-0000-0000-0000-000000000000',
        tenantId: '00000000-0000-0000-0000-000000000000',
        account: 'zeno@beispiel.ch',
        calendars: [
          { id: 'c1', name: 'Kalender', enabled: true },
          { id: 'c2', name: 'Geburtstage', enabled: false },
          { id: 'c3', name: 'Team Marketing', enabled: true },
        ],
      },
      { id: 'demo-g', kind: 'ics', name: 'Privat' },
      { id: 'demo-p', kind: 'ics', name: 'Planbar' },
    ],
  };
}

export type DemoScenario = 'tag' | 'leer' | 'ganztags' | 'mehrere';

export function demoEvents(nowMs: number, zone: string, scenario: DemoScenario): Record<string, CalendarEvent[]> {
  const day = DateTime.fromMillis(nowMs, { zone }).startOf('day');
  const t = (hhmm: string, offsetDays = 0) => {
    const [h, m] = hhmm.split(':').map(Number);
    return day.plus({ days: offsetDays }).set({ hour: h, minute: m }).toMillis();
  };
  let n = 0;
  const mk = (sourceId: string, calendarName: string, title: string, s: string, e: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
    id: `${sourceId}:${++n}`,
    sourceId,
    calendarName,
    title,
    start: t(s),
    end: t(e),
    allDay: false,
    location: null,
    onlineUrl: null,
    webLink: null,
    isCancelled: false,
    response: 'accepted',
    showAs: 'busy',
    isPrivate: false,
    ...extra,
  });

  if (scenario === 'leer') return { 'demo-ms': [], 'demo-g': [], 'demo-p': [] };

  if (scenario === 'ganztags') {
    return {
      'demo-ms': [mk('demo-ms', 'Kalender', 'Weiterbildung UX', '00:00', '00:00', { allDay: true, start: day.toMillis(), end: day.plus({ days: 1 }).toMillis(), location: 'Bern' })],
      'demo-g': [],
      'demo-p': [],
    };
  }

  const work = [
    mk('demo-ms', 'Kalender', 'Standup Team', '08:30', '09:00', { onlineUrl: 'https://teams.microsoft.com/l/meetup-join/demo', location: 'Microsoft Teams-Besprechung', webLink: 'https://outlook.office.com/calendar' }),
    mk('demo-ms', 'Kalender', 'Wochenplanung', '09:15', '10:00', { location: 'Sitzungszimmer 2', webLink: 'https://outlook.office.com/calendar' }),
    mk('demo-ms', 'Kalender', 'Kundengespräch Muster AG', '11:00', '12:30', { location: 'Muster AG, Zürich' }),
    mk('demo-ms', 'Team Marketing', 'Review Kampagne Herbst', '14:30', '15:30', { onlineUrl: 'https://teams.microsoft.com/l/meetup-join/demo2' }),
    mk('demo-ms', 'Kalender', '1:1 mit Lea', '16:00', '16:45'),
    mk('demo-ms', 'Kalender', 'Telefon Druckerei', '17:00', '17:30'),
    mk('demo-ms', 'Kalender', 'Teamsitzung', '08:00', '09:00', { start: t('08:00', 1), end: t('09:00', 1), location: 'Sitzungszimmer 1' }),
  ];
  if (scenario === 'mehrere') {
    work.push(mk('demo-ms', 'Kalender', 'Abstimmung Layout', '14:45', '15:00'));
  }
  const privat = [
    mk('demo-g', 'Privat', 'Geburtstag Lea', '00:00', '00:00', { allDay: true, start: day.toMillis(), end: day.plus({ days: 1 }).toMillis(), showAs: 'free' }),
    mk('demo-g', 'Privat', 'Mittagessen mit Sam', '12:30', '13:15', { location: 'Café Zentral' }),
    mk('demo-g', 'Privat', 'Therapie', '18:00', '18:45', { isPrivate: true }),
  ];
  const planbar = [
    mk('demo-p', 'Planbar', 'Layout Herbstkampagne', '13:15', '14:30', { webLink: 'https://planbar.example/tickets/t1' }),
  ];
  return { 'demo-ms': work, 'demo-g': privat, 'demo-p': planbar };
}

export interface DemoParams {
  enabled: boolean;
  scenario: DemoScenario;
  /** Feste Uhrzeit «HH:MM» für Screenshots */
  now: string | null;
  theme: Settings['theme'];
  /** Startansicht für Screenshots */
  view: 'today' | 'settings' | 'add-source' | 'source';
  /** Fester 340×620-Rahmen für Screenshots */
  frame: boolean;
}

export function readDemoParams(search: string): DemoParams {
  const q = new URLSearchParams(search);
  const scenarioRaw = q.get('demo');
  const scenario: DemoScenario =
    scenarioRaw === 'leer' || scenarioRaw === 'ganztags' || scenarioRaw === 'mehrere' ? scenarioRaw : 'tag';
  const themeRaw = q.get('theme');
  const theme: Settings['theme'] = themeRaw === 'light' || themeRaw === 'dark' ? themeRaw : 'system';
  const viewRaw = q.get('view');
  const view: DemoParams['view'] =
    viewRaw === 'settings' || viewRaw === 'add-source' || viewRaw === 'source' ? viewRaw : 'today';
  return { enabled: q.has('demo'), scenario, now: q.get('now'), theme, view, frame: q.has('frame') };
}

export function demoNow(param: string | null, zone: string): number | null {
  if (!param || !/^\d{2}:\d{2}$/.test(param)) return null;
  const [h, m] = param.split(':').map(Number);
  return DateTime.now().setZone(zone).set({ hour: h, minute: m, second: 0, millisecond: 0 }).toMillis();
}
