import { DateTime, IANAZone } from 'luxon';
import type { CalendarEvent, ResponseStatus, ShowAs, TimeWindow } from '../model/event';

export const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export const CALENDAR_VIEW_SELECT = [
  'id',
  'subject',
  'start',
  'end',
  'isAllDay',
  'location',
  'onlineMeeting',
  'isOnlineMeeting',
  'onlineMeetingUrl',
  'isCancelled',
  'showAs',
  'responseStatus',
  'sensitivity',
  'webLink',
].join(',');

export interface GraphDateTime {
  dateTime: string;
  timeZone: string;
}

export interface GraphEventRaw {
  id: string;
  subject?: string | null;
  start: GraphDateTime;
  end: GraphDateTime;
  isAllDay?: boolean;
  location?: { displayName?: string | null } | null;
  onlineMeeting?: { joinUrl?: string | null } | null;
  isOnlineMeeting?: boolean;
  onlineMeetingUrl?: string | null;
  isCancelled?: boolean;
  showAs?: string | null;
  responseStatus?: { response?: string | null } | null;
  sensitivity?: string | null;
  webLink?: string | null;
}

export interface GraphCalendarRaw {
  id: string;
  name: string;
  isDefaultCalendar?: boolean;
  canShare?: boolean;
  owner?: { name?: string | null; address?: string | null } | null;
}

export interface GraphPage<T> {
  value: T[];
  '@odata.nextLink'?: string;
}

export interface GraphContext {
  sourceId: string;
  calendarName: string;
  /** Systemzeitzone für ganztägige Termine */
  zone: string;
}

function isoUtc(ms: number): string {
  return DateTime.fromMillis(ms, { zone: 'utc' }).toISO({ suppressMilliseconds: true }) ?? '';
}

export function calendarsUrl(): string {
  return `${GRAPH_BASE}/me/calendars?$select=id,name,isDefaultCalendar,owner&$top=50`;
}

/** `GET /me/calendars/{id}/calendarView?...` (Pflichtenheft 5.1) */
export function calendarViewUrl(calendarId: string, window: TimeWindow): string {
  const params = new URLSearchParams({
    startDateTime: isoUtc(window.start),
    endDateTime: isoUtc(window.end),
    $select: CALENDAR_VIEW_SELECT,
    $orderby: 'start/dateTime',
    $top: '50',
  });
  return `${GRAPH_BASE}/me/calendars/${encodeURIComponent(calendarId)}/calendarView?${params.toString()}`;
}

/**
 * Graph liefert Zeiten ohne `Prefer`-Header in UTC mit sieben Nachkommastellen.
 * Ganztägige Termine kommen als Mitternacht des Kalendertags; der Tag gilt lokal.
 */
export function graphTimeToMillis(dt: GraphDateTime, allDay: boolean, zone: string): number {
  if (allDay) {
    return DateTime.fromISO(dt.dateTime.slice(0, 10), { zone }).toMillis();
  }
  const iso = dt.dateTime.replace(/(\.\d{3})\d+/, '$1');
  const tz = !dt.timeZone || dt.timeZone === 'UTC' ? 'utc' : IANAZone.isValidZone(dt.timeZone) ? dt.timeZone : 'utc';
  return DateTime.fromISO(iso, { zone: tz }).toMillis();
}

function mapResponse(v: string | null | undefined): ResponseStatus {
  switch (v) {
    case 'accepted':
      return 'accepted';
    case 'declined':
      return 'declined';
    case 'tentativelyAccepted':
      return 'tentative';
    case 'organizer':
      return 'organizer';
    default:
      return 'none';
  }
}

function mapShowAs(v: string | null | undefined): ShowAs {
  switch (v) {
    case 'free':
    case 'tentative':
    case 'busy':
    case 'oof':
    case 'workingElsewhere':
      return v;
    default:
      return 'unknown';
  }
}

export function mapGraphEvent(raw: GraphEventRaw, ctx: GraphContext): CalendarEvent {
  const allDay = raw.isAllDay === true;
  const start = graphTimeToMillis(raw.start, allDay, ctx.zone);
  const end = graphTimeToMillis(raw.end, allDay, ctx.zone);
  const sensitivity = raw.sensitivity ?? 'normal';
  const onlineUrl = raw.onlineMeeting?.joinUrl ?? raw.onlineMeetingUrl ?? null;
  return {
    id: `${ctx.sourceId}:${raw.id}:${start}`,
    sourceId: ctx.sourceId,
    calendarName: ctx.calendarName,
    title: raw.subject ?? '',
    start,
    end: Math.max(end, start),
    allDay,
    location: raw.location?.displayName?.trim() || null,
    onlineUrl: onlineUrl && onlineUrl.length > 0 ? onlineUrl : null,
    webLink: raw.webLink ?? null,
    isCancelled: raw.isCancelled === true,
    response: mapResponse(raw.responseStatus?.response),
    showAs: mapShowAs(raw.showAs),
    isPrivate: sensitivity === 'private' || sensitivity === 'confidential',
  };
}

export type FetchJson = <T>(url: string) => Promise<T>;

/** Folgt `@odata.nextLink` bis zum Ende (Pflichtenheft 5.1, Schritt 3) */
export async function fetchAllPages<T>(fetchJson: FetchJson, firstUrl: string, maxPages = 50): Promise<T[]> {
  const out: T[] = [];
  let url: string | undefined = firstUrl;
  let pages = 0;
  while (url && pages++ < maxPages) {
    const page: GraphPage<T> = await fetchJson<GraphPage<T>>(url);
    out.push(...(Array.isArray(page.value) ? page.value : []));
    url = page['@odata.nextLink'];
  }
  return out;
}

export async function fetchCalendarView(
  fetchJson: FetchJson,
  calendarId: string,
  window: TimeWindow,
  ctx: GraphContext,
): Promise<CalendarEvent[]> {
  const raw = await fetchAllPages<GraphEventRaw>(fetchJson, calendarViewUrl(calendarId, window));
  return raw.map((r) => mapGraphEvent(r, ctx));
}

export async function fetchCalendars(fetchJson: FetchJson): Promise<GraphCalendarRaw[]> {
  return fetchAllPages<GraphCalendarRaw>(fetchJson, calendarsUrl());
}
