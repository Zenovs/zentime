import type { CalendarEvent } from '../model/event';
import { formatTime } from './day';
import { nextEvent, runningEvents } from './timeline';

export type HeroKind = 'running' | 'soon' | 'later' | 'tomorrow' | 'allDayOnly' | 'done' | 'none';

export interface Hero {
  kind: HeroKind;
  /** Grosse Zahl oder Uhrzeit («25», «14:30», «frei») */
  big: string;
  /** Einheit neben der Zahl («min», «h») oder `null` */
  unit: string | null;
  /** Gedämpfter Vorspann der Zeile darunter («läuft · », «bis ») */
  muted: string;
  /** Titel bzw. Hinweis */
  text: string;
  /** Termin, auf den sich der Hero bezieht (für das Detailraster) */
  eventId: string | null;
}

export interface HeroInput {
  /** Zeitgebundene Termine von heute (bereits gefiltert und sortiert) */
  timed: readonly CalendarEvent[];
  /** Ganztägige Termine von heute */
  allDay: readonly CalendarEvent[];
  /** Zeitgebundene Termine von morgen (F-12); leer, wenn nicht geladen */
  tomorrowTimed: readonly CalendarEvent[];
  now: number;
  zone: string;
}

const HOUR = 60 * 60_000;

/** Restzeit bzw. Wartezeit als Zahl plus Einheit: «25 min», «1:35 h» */
function countdown(ms: number): { big: string; unit: string } {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes <= 60) return { big: String(minutes), unit: 'min' };
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return { big: `${h}:${String(m).padStart(2, '0')}`, unit: 'h' };
}

export function displayTitle(ev: CalendarEvent): string {
  return ev.isPrivate ? 'Privat' : ev.title || '(ohne Titel)';
}

/** Hero-Logik nach Pflichtenheft 7.2 */
export function computeHero(input: HeroInput): Hero {
  const { timed, allDay, tomorrowTimed, now, zone } = input;

  const running = runningEvents(timed, now);
  const first = running[0];
  if (first) {
    const { big, unit } = countdown(first.end - now);
    const more = running.length > 1 ? ` +${running.length - 1}` : '';
    return { kind: 'running', big, unit, muted: 'läuft · ', text: displayTitle(first) + more, eventId: first.id };
  }

  const next = nextEvent(timed, now);
  if (next) {
    const wait = next.start - now;
    if (wait <= HOUR) {
      const { big, unit } = countdown(wait);
      return { kind: 'soon', big, unit, muted: 'bis ', text: displayTitle(next), eventId: next.id };
    }
    return { kind: 'later', big: formatTime(next.start, zone), unit: null, muted: '', text: displayTitle(next), eventId: next.id };
  }

  const firstAllDay = allDay[0];
  if (timed.length === 0 && firstAllDay) {
    const more = allDay.length > 1 ? ` +${allDay.length - 1}` : '';
    return { kind: 'allDayOnly', big: 'frei', unit: null, muted: '', text: displayTitle(firstAllDay) + more, eventId: firstAllDay.id };
  }

  const tomorrow = tomorrowTimed[0];
  if (tomorrow) {
    return {
      kind: 'tomorrow',
      big: 'frei',
      unit: null,
      muted: `Morgen ${formatTime(tomorrow.start, zone)} · `,
      text: displayTitle(tomorrow),
      eventId: tomorrow.id,
    };
  }

  if (timed.length === 0) {
    return { kind: 'none', big: 'frei', unit: null, muted: '', text: 'Heute keine Termine', eventId: null };
  }

  const last = timed[timed.length - 1] ?? null;
  return {
    kind: 'done',
    big: 'frei',
    unit: null,
    muted: '',
    text: firstAllDay ? displayTitle(firstAllDay) : 'Heute nichts mehr',
    eventId: last?.id ?? null,
  };
}
