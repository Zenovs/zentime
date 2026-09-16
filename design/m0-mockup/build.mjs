#!/usr/bin/env node
// zentime · M0 Mockup
// Erzeugt die Artboards (<Name>.dc.html) und canvas.json aus einer Datenbeschreibung,
// damit Hell und Dunkel sowie alle Hero-Zustände aus einer Quelle kommen.
// Aufruf: node design/m0-mockup/build.mjs

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Design-Tokens (Pflichtenheft 7.5) plus wenige abgeleitete Werte
// ---------------------------------------------------------------------------
const THEMES = {
  Hell: {
    bg: '#EBEBEB', fg: '#1E1E1E', muted: '#8A8A8A', line: '#D6D6D6',
    desk: '#FFFFFF', knobOn: '#EBEBEB', knobOff: '#FFFFFF', toggleIcon: 'moon',
  },
  Dunkel: {
    bg: '#262626', fg: '#F2F2F2', muted: '#8C8C8C', line: '#3A3A3A',
    desk: '#0F0F0F', knobOn: '#262626', knobOff: '#8C8C8C', toggleIcon: 'sun',
  },
};

// Kalender-Markierung (F-18): gedämpfte Töne, gleiche Helligkeit/Chroma
const CAL = {
  arbeit: { name: 'Arbeit', dot: '#7A93B3' },
  privat: { name: 'Privat', dot: '#8FA986' },
};

// ---------------------------------------------------------------------------
// Lucide-Icons (24er Raster, Strichstärke 1.5)
// ---------------------------------------------------------------------------
const svg = (inner, size = 20) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

const PATHS = {
  sun: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>',
  video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"></path><rect x="2" y="6" width="14" height="12" rx="2"></rect>',
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle>',
  dot: '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"></circle>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path>',
  x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
  plus: '<path d="M5 12h14"></path><path d="M12 5v14"></path>',
  chevronRight: '<path d="m9 18 6-6-6-6"></path>',
  chevronLeft: '<path d="m15 18-6-6 6-6"></path>',
  externalLink: '<path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>',
};
const ICON = Object.fromEntries(Object.entries(PATHS).map(([k, v]) => [k, svg(v)]));
const ICON16 = Object.fromEntries(Object.entries(PATHS).map(([k, v]) => [k, svg(v, 16)]));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------------------
// Anonymisierte Beispieldaten: Mittwoch, 16. September 2026
// ---------------------------------------------------------------------------
const DAY = [
  { s: '08:30', e: '09:00', title: 'Standup Team', kind: 'video', cal: 'arbeit', loc: 'Teams' },
  { s: '09:15', e: '10:00', title: 'Wochenplanung', kind: 'pin', cal: 'arbeit', loc: 'Sitzungszimmer 2' },
  { s: '11:00', e: '12:30', title: 'Kundengespräch Muster AG', kind: 'pin', cal: 'arbeit', loc: 'Muster AG, Zürich' },
  { s: '12:30', e: '13:15', title: 'Mittagessen mit Sam', kind: 'pin', cal: 'privat', loc: 'Café Zentral' },
  { s: '14:30', e: '15:30', title: 'Review Kampagne Herbst', kind: 'video', cal: 'arbeit', loc: 'Teams' },
  { s: '16:00', e: '16:45', title: '1:1 mit Lea', kind: 'dot', cal: 'arbeit', loc: null },
  { s: '17:00', e: '17:30', title: 'Telefon Druckerei', kind: 'dot', cal: 'arbeit', loc: null },
];
const DAY_OVERLAP = [
  ...DAY.slice(0, 5),
  { s: '14:45', e: '15:00', title: 'Abstimmung Layout', kind: 'dot', cal: 'arbeit', loc: null },
  ...DAY.slice(5),
];

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const dur = (ev) => {
  const d = toMin(ev.e) - toMin(ev.s);
  const h = Math.floor(d / 60), m = d % 60;
  if (h === 0) return `${m}′`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m}′`;
};

const DASH = '–';

// Hero-Zustände nach Pflichtenheft 7.2, je mit fixer «Jetzt»-Zeit
const STATES = [
  {
    key: 'Laeuft', label: '1 · Termin läuft', now: '09:35',
    hero: { big: '25', unit: 'min', pre: 'läuft · ', text: 'Wochenplanung' },
    allDay: { title: 'Geburtstag Lea', cal: 'privat' },
    events: DAY, past: [0], running: [1], selected: 1, scrollStart: 0,
    details: { start: '09:15', end: '10:00', loc: 'Sitzungszimmer 2', cal: 'arbeit', remaining: '5 Termine', gap: '10:00–11:00' },
  },
  {
    key: 'Bald', label: '2 · Nächster Termin ≤ 60 min', now: '10:18',
    hero: { big: '42', unit: 'min', pre: 'bis ', text: 'Kundengespräch Muster AG' },
    allDay: { title: 'Geburtstag Lea', cal: 'privat' },
    events: DAY, past: [0, 1], running: [], selected: 2, scrollStart: 1,
    details: { start: '11:00', end: '12:30', loc: 'Muster AG, Zürich', cal: 'arbeit', remaining: '5 Termine', gap: '13:15–14:30' },
  },
  {
    key: 'Spaeter', label: '3 · Nächster Termin > 60 min (offline)', now: '13:20',
    headerIcon: 'alert', dateSuffix: ' · Stand 13:15',
    hero: { big: '14:30', unit: null, pre: '', text: 'Review Kampagne Herbst' },
    allDay: { title: 'Geburtstag Lea', cal: 'privat' },
    events: DAY, past: [0, 1, 2, 3], running: [], selected: 4, scrollStart: 2,
    details: { start: '14:30', end: '15:30', loc: 'Teams', online: true, cal: 'arbeit', remaining: '3 Termine', gap: '15:30–16:00' },
  },
  {
    key: 'Mehrere', label: '4 · Mehrere Termine gleichzeitig', now: '14:48',
    hero: { big: '12', unit: 'min', pre: 'läuft · ', text: 'Abstimmung Layout +1' },
    allDay: { title: 'Geburtstag Lea', cal: 'privat' },
    events: DAY_OVERLAP, past: [0, 1, 2, 3], running: [4, 5], selected: 5, scrollStart: 4,
    details: { start: '14:45', end: '15:00', loc: DASH, cal: 'arbeit', remaining: '2 Termine', gap: '15:30–16:00' },
  },
  {
    key: 'Morgen', label: '5 · Heute nichts mehr, morgen etwas', now: '17:50',
    hero: { big: 'frei', unit: null, pre: '', text: 'Morgen 08:00 · Teamsitzung' },
    allDay: { title: 'Geburtstag Lea', cal: 'privat' },
    events: DAY, past: [0, 1, 2, 3, 4, 5, 6], running: [], selected: -1, scrollStart: 3,
    details: { start: '08:00', end: '09:00', loc: 'Sitzungszimmer 1', cal: 'arbeit', remaining: 'keine', gap: DASH },
  },
  {
    key: 'Leer', label: '6 · Heute keine Termine', now: '10:00',
    hero: { big: 'frei', unit: null, pre: '', text: 'Heute keine Termine' },
    allDay: null,
    events: [], past: [], running: [], selected: -1, scrollStart: 0,
    details: { start: DASH, end: DASH, loc: DASH, cal: null, remaining: 'keine', gap: DASH },
  },
  {
    key: 'Ganztags', label: '7 · Nur ganztägige Termine', now: '10:00',
    hero: { big: 'frei', unit: null, pre: '', text: 'Weiterbildung UX' },
    allDay: { title: 'Weiterbildung UX', cal: 'arbeit' },
    events: [], past: [], running: [], selected: -1, scrollStart: 0,
    details: { start: 'Ganztägig', end: DASH, loc: 'Bern', cal: 'arbeit', remaining: 'keine', gap: DASH },
  },
];

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------
function page(t, body) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&amp;display=swap">
  <style>
    html, body { margin: 0; padding: 0; background: ${t.desk}; }
    body { font-family: Inter, -apple-system, "Segoe UI", system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    * { box-sizing: border-box; }
    a { color: ${t.fg}; } a:hover { color: ${t.muted}; }
  </style>
</helmet>
${body}
</x-dc>
</body>
</html>
`;
}

function shell(t, inner) {
  return `<div style="width: 340px; height: 620px; padding: 24px; border-radius: 24px; background: ${t.bg}; color: ${t.fg}; display: flex; flex-direction: column; overflow: hidden;">
${inner}
</div>`;
}

const iconBox = (t, name, color, size = 20) =>
  `<div style="width: ${size}px; height: ${size}px; color: ${color}; display: flex; flex: 0 0 auto;">${size === 16 ? ICON16[name] : ICON[name]}</div>`;

const calDot = (cal, size = 8) =>
  `<span style="width: ${size}px; height: ${size}px; border-radius: ${size / 2}px; background: ${CAL[cal].dot}; flex: 0 0 auto;"></span>`;

function header(t, { title, sub, icon }) {
  return `  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
    <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;">
      <div style="font-size: 20px; line-height: 24px; font-weight: 600;">${esc(title)}</div>
      <div style="font-size: 13px; line-height: 18px; color: ${t.muted}; white-space: nowrap;">${esc(sub)}</div>
    </div>
    ${iconBox(t, icon, t.muted)}
  </div>`;
}

function hero(t, h) {
  const unit = h.unit
    ? `<span style="font-size: 24px; line-height: 32px; font-weight: 600; color: ${t.muted};">${esc(h.unit)}</span>`
    : '';
  const pre = h.pre ? `<span style="color: ${t.muted};">${esc(h.pre)}</span>` : '';
  return `  <div style="margin-top: 24px; display: flex; flex-direction: column; gap: 8px;">
    <div style="display: flex; align-items: baseline; gap: 8px;">
      <span style="font-size: 96px; line-height: 96px; font-weight: 800; letter-spacing: -0.04em; font-variant-numeric: tabular-nums;">${esc(h.big)}</span>${unit}
    </div>
    <div style="font-size: 18px; line-height: 24px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${pre}${esc(h.text)}</div>
  </div>`;
}

function allDay(t, a) {
  return `  <div style="margin-top: 24px; display: flex; align-items: center; gap: 8px; font-size: 13px; line-height: 18px; white-space: nowrap; overflow: hidden;">
    ${calDot(a.cal, 6)}
    <span style="color: ${t.muted};">Ganztägig ·</span>
    <span style="font-weight: 600; overflow: hidden; text-overflow: ellipsis;">${esc(a.title)}</span>
  </div>`;
}

function timeline(t, st) {
  const cols = st.events.slice(st.scrollStart).map((ev, i) => {
    const idx = i + st.scrollStart;
    const past = st.past.includes(idx);
    const running = st.running.includes(idx);
    const selected = st.selected === idx;
    const bg = selected || running ? t.line : 'transparent';
    return `    <div style="flex: 0 0 60px; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 0; border-radius: 12px; background: ${bg}; opacity: ${past ? '0.4' : '1'};">
      <div style="font-size: 13px; line-height: 16px; color: ${running ? t.fg : t.muted}; font-variant-numeric: tabular-nums;">${ev.s}</div>
      ${iconBox(t, ev.kind, t.fg)}
      <div style="font-size: 14px; line-height: 20px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap;">${dur(ev)}</div>
    </div>`;
  }).join('\n');
  return `  <div style="margin: ${st.allDay ? 12 : 24}px -24px 24px; padding: 0 24px; display: flex; gap: 8px; overflow: hidden;">
${cols}
  </div>`;
}

function details(t, d) {
  const text = (v) => `<span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;">${esc(v)}</span>`;
  const cell = (label, inner) => `      <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0;">
        <div style="font-size: 13px; line-height: 16px; color: ${t.muted};">${label}</div>
        <div style="font-size: 18px; line-height: 24px; font-weight: 600; font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 8px; min-width: 0;">${inner}</div>
      </div>`;
  const row = (a, b, last) => `    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; padding: ${last ? '8px 0 0' : '8px 0'};${last ? '' : ` border-bottom: 1px solid ${t.line};`}">
${a}
${b}
    </div>`;
  const loc = d.online
    ? `${text(d.loc)}${iconBox(t, 'externalLink', t.muted, 16)}`
    : text(d.loc);
  const cal = d.cal ? `${calDot(d.cal)}${text(CAL[d.cal].name)}` : text(DASH);
  return `  <div style="margin-top: auto; border-top: 1px solid ${t.line};">
${row(cell('Beginn', text(d.start)), cell('Ende', text(d.end)))}
${row(cell('Ort', loc), cell('Kalender', cal))}
${row(cell('Noch heute', text(d.remaining)), cell('Nächste Lücke', text(d.gap)), true)}
  </div>`;
}

function widget(t, st) {
  const parts = [
    header(t, {
      title: 'Heute',
      sub: 'Mittwoch, 16. September' + (st.dateSuffix || ''),
      icon: st.headerIcon || t.toggleIcon,
    }),
    hero(t, st.hero),
  ];
  if (st.allDay) parts.push(allDay(t, st.allDay));
  if (st.events.length) parts.push(timeline(t, st));
  parts.push(details(t, st.details));
  return page(t, shell(t, parts.join('\n')));
}

// ---------------------------------------------------------------------------
// Einstellungen (F-10, F-09, F-11, F-13, F-17)
// ---------------------------------------------------------------------------
const toggle = (t, on) =>
  `<div style="width: 40px; height: 24px; border-radius: 12px; background: ${on ? t.fg : t.line}; position: relative; flex: 0 0 auto;"><div style="position: absolute; top: 2px; left: ${on ? 18 : 2}px; width: 20px; height: 20px; border-radius: 10px; background: ${on ? t.knobOn : t.knobOff};"></div></div>`;

const segmented = (t, items, active, height = 32) =>
  `<div style="display: grid; grid-template-columns: repeat(${items.length}, minmax(0, 1fr)); gap: 2px; padding: 2px; border-radius: 10px; background: ${t.line}; height: ${height}px;">
${items.map((label, i) => `      <div style="display: flex; align-items: center; justify-content: center; border-radius: 8px; background: ${i === active ? t.bg : 'transparent'}; color: ${i === active ? t.fg : t.muted}; font-size: 13px; line-height: 16px; font-weight: 600;">${esc(label)}</div>`).join('\n')}
    </div>`;

const sectionLabel = (t, label) =>
  `<div style="font-size: 13px; line-height: 16px; color: ${t.muted};">${esc(label)}</div>`;

function settings(t, { msError }) {
  const sourceRow = (cal, name, subHtml, trailing, border) => `    <div style="display: flex; align-items: center; gap: 12px; padding: 8px 0;${border ? ` border-top: 1px solid ${t.line};` : ''}">
      ${calDot(cal)}
      <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
        <div style="font-size: 15px; line-height: 20px; font-weight: 600;">${esc(name)}</div>
        <div style="font-size: 13px; line-height: 16px; color: ${t.muted}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${subHtml}</div>
      </div>
      ${trailing}
    </div>`;
  const calRow = (name, on) => `    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0 4px 20px;">
      <div style="font-size: 15px; line-height: 20px;">${esc(name)}</div>
      ${toggle(t, on)}
    </div>`;
  const prefRow = (name, on) => `    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0;">
      <div style="font-size: 15px; line-height: 20px;">${esc(name)}</div>
      ${toggle(t, on)}
    </div>`;

  const msSub = msError
    ? `Anmeldung abgelaufen · <span style="color: ${t.fg}; font-weight: 600;">Neu anmelden</span>`
    : `zeno@beispiel.ch · verbunden`;
  const msTrailing = iconBox(t, msError ? 'alert' : 'chevronRight', t.muted);

  const body = [
    `  <div style="display: flex; justify-content: space-between; align-items: center; gap: 16px;">
    <div style="font-size: 20px; line-height: 24px; font-weight: 600;">Einstellungen</div>
    ${iconBox(t, 'x', t.muted)}
  </div>`,
    `  <div style="margin-top: 24px; display: flex; flex-direction: column; gap: 8px;">
    ${sectionLabel(t, 'Quellen')}
    <div style="display: flex; flex-direction: column;">
${sourceRow('arbeit', 'Microsoft 365', msSub, msTrailing, false)}
${calRow('Kalender', true)}
${calRow('Geburtstage', false)}
${calRow('Team Marketing', true)}
${sourceRow('privat', 'Google Kalender', 'Privat · ICS · vor 4 min aktualisiert', iconBox(t, 'chevronRight', t.muted), true)}
    <div style="display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid ${t.line};">
      ${iconBox(t, 'plus', t.fg)}
      <div style="font-size: 15px; line-height: 20px; font-weight: 600;">Quelle hinzufügen</div>
    </div>
    </div>
  </div>`,
    `  <div style="margin-top: 24px; display: flex; flex-direction: column; gap: 8px;">
    ${sectionLabel(t, 'Darstellung')}
    ${segmented(t, ['System', 'Hell', 'Dunkel'], 0)}
    <div style="display: flex; flex-direction: column;">
${prefRow('Immer im Vordergrund', true)}
${prefRow('Beim Anmelden starten', false)}
${prefRow('Abgelehnte Termine ausblenden', true)}
    </div>
  </div>`,
    `  <div style="margin-top: auto; font-size: 13px; line-height: 18px; color: ${t.muted};">zentime 0.1.0</div>`,
  ];
  return page(t, shell(t, body.join('\n')));
}

// ---------------------------------------------------------------------------
// Quelle hinzufügen (5.1 / 5.2)
// ---------------------------------------------------------------------------
function addSource(t, variant) {
  const field = (label, value, placeholder) => `    <div style="display: flex; flex-direction: column; gap: 4px;">
      <div style="font-size: 13px; line-height: 16px; color: ${t.muted};">${esc(label)}</div>
      <div style="height: 44px; padding: 0 12px; border: 1px solid ${t.line}; border-radius: 12px; display: flex; align-items: center; font-size: 15px; line-height: 20px; color: ${placeholder ? t.muted : t.fg}; white-space: nowrap; overflow: hidden;"><span style="overflow: hidden; text-overflow: ellipsis;">${esc(value)}</span></div>
    </div>`;
  const button = (label) => `  <div style="margin-top: 24px; height: 44px; border-radius: 12px; background: ${t.fg}; color: ${t.bg}; display: flex; align-items: center; justify-content: center; font-size: 15px; line-height: 20px; font-weight: 600;">${esc(label)}</div>`;
  const helper = (text) => `  <div style="margin-top: 16px; font-size: 13px; line-height: 18px; color: ${t.muted};">${esc(text)}</div>`;

  const isMs = variant === 'ms';
  const fields = isMs
    ? [
        field('Anzeigename', 'Arbeit', false),
        field('Client-ID', '00000000-0000-0000-0000-…', true),
        field('Tenant-ID', '00000000-0000-0000-0000-…', true),
      ]
    : [
        field('Anzeigename', 'Privat', false),
        field('Geheime iCal-Adresse', 'https://calendar.google.com/calendar/ical/…/basic.ics', true),
      ];
  const help = isMs
    ? 'Beide Werte stammen aus der App-Registrierung in Entra ID. Ein Client-Secret ist nicht nötig; der Login öffnet den Systembrowser.'
    : 'Google Kalender → Einstellungen → «Kalender integrieren» → «Geheime Adresse im iCal-Format». Die Adresse wird nur im Schlüsselbund gespeichert.';

  const body = [
    `  <div style="display: flex; align-items: center; gap: 12px;">
    ${iconBox(t, 'chevronLeft', t.muted)}
    <div style="font-size: 20px; line-height: 24px; font-weight: 600;">Quelle hinzufügen</div>
  </div>`,
    `  <div style="margin-top: 24px;">
    ${segmented(t, ['Microsoft 365', 'Google Kalender'], isMs ? 0 : 1)}
  </div>`,
    `  <div style="margin-top: 24px; display: flex; flex-direction: column; gap: 16px;">
${fields.join('\n')}
  </div>`,
    helper(help),
    button(isMs ? 'Mit Microsoft anmelden' : 'Kalender hinzufügen'),
  ];
  return page(t, shell(t, body.join('\n')));
}

// ---------------------------------------------------------------------------
// Dateien schreiben
// ---------------------------------------------------------------------------
const artboards = [];
const W = 340, H = 620, GAP_X = 80, ROW_Y = { Hell: 120, Dunkel: 120 + H + 160 };

for (const [themeName, t] of Object.entries(THEMES)) {
  let col = 0;
  const place = (stem, title, html) => {
    writeFileSync(join(OUT, `${stem}.dc.html`), html);
    artboards.push({ file: `${stem}.dc.html`, title, x: col * (W + GAP_X), y: ROW_Y[themeName], w: W, h: H });
    col += 1;
  };
  for (const st of STATES) {
    const stem = themeName === 'Hell' && st.key === 'Laeuft' ? 'Main' : `${themeName}${st.key}`;
    place(stem, `${themeName} · ${st.label}`, widget(t, st));
  }
  const dark = themeName === 'Dunkel';
  place(`${themeName}Einstellungen`, `${themeName} · Einstellungen${dark ? ' (Quelle mit Fehler)' : ''}`, settings(t, { msError: dark }));
  place(`${themeName}Quelle`, `${themeName} · Quelle hinzufügen (${dark ? 'Google ICS' : 'Microsoft 365'})`, addSource(t, dark ? 'google' : 'ms'));
}

const canvas = {
  artboards,
  annotations: [
    {
      id: 'legende', x: 0, y: 0, w: 640,
      text: 'zentime · M0 Mockup (Pflichtenheft 0.1)\n'
        + 'Obere Reihe Hell, untere Reihe Dunkel. Spalten 1–7 sind die Hero-Zustände aus 7.2, danach Einstellungen und «Quelle hinzufügen».\n'
        + 'Zustand 3 zeigt zusätzlich den Offline-Fall (Warn-Icon, «Stand 13:15»). Dunkel: Einstellungen mit abgelaufener Microsoft-Anmeldung, Quelle-Dialog in der Google-Variante.',
    },
    {
      id: 'hero-einheit', x: 0, y: ROW_Y.Dunkel + H + 40, w: 420,
      text: 'Abweichung zum Pflichtenheft: «25 min» passt bei 96 px nicht in 292 px Breite. Vorschlag: Zahl 96 px, Einheit «min» 24 px gedämpft, auf der Grundlinie – analog zur Wetter-App.',
    },
    {
      id: 'tagesleiste', x: 460, y: ROW_Y.Dunkel + H + 40, w: 420,
      text: 'Tagesleiste: Spalten 60 px, laufen rechts aus dem Fenster (Scroll-Hinweis). Ausgewählter bzw. laufender Termin mit Fläche in --line, vergangene 40 % Deckkraft. Beim laufenden Termin ist die Startzeit in --fg.',
    },
  ],
  launch: { view: 'canvas' },
};
writeFileSync(join(OUT, 'canvas.json'), JSON.stringify(canvas, null, 2) + '\n');

console.log(`${artboards.length} Artboards + canvas.json → ${OUT}`);
