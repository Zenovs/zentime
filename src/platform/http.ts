import { isTauri } from './env';

export type HttpFetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * HTTP über `tauri-plugin-http`: Requests laufen im Rust-Teil, damit weder
 * CORS noch Cookies des WebViews eine Rolle spielen. Im Browser (Entwicklung)
 * wird `window.fetch` verwendet.
 */
/** Kein Abruf darf ewig hängen, sonst bleibt die Quelle auf «wird geladen» */
export const REQUEST_TIMEOUT_MS = 30_000;

export const httpFetch: HttpFetch = async (input, init) => {
  const withTimeout: RequestInit = { ...init, signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS) };
  if (isTauri) {
    const { fetch } = await import('@tauri-apps/plugin-http');
    // `tauri-plugin-http` setzt sonst den Origin des WebViews. Entra wertet den
    // Token-Tausch dann als Cross-Origin-Anfrage und lehnt ihn für alles ab, was
    // kein SPA-Client ist (AADSTS9002326). Ein leerer Origin veranlasst das
    // Plugin, den Header ganz zu entfernen – wie es sich für eine Desktop-App
    // gehört, die keinen Browser-Ursprung hat.
    const headers = new Headers(withTimeout.headers);
    headers.set('Origin', '');
    return fetch(input, { ...withTimeout, headers });
  }
  return window.fetch(input, withTimeout);
};

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Liest `Retry-After` (Sekunden oder HTTP-Datum) in Millisekunden */
export function retryAfterMs(res: Response, nowMs = Date.now()): number | null {
  const v = res.headers.get('retry-after');
  if (!v) return null;
  const secs = Number(v);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(v);
  return Number.isNaN(date) ? null : Math.max(0, date - nowMs);
}

/** Kalender-Kennung aus einem Google-Link: entweder im Klartext oder base64 */
function googleCalendarId(raw: string): string | null {
  const value = decodeURIComponent(raw.trim());
  if (value.includes('@')) return value;
  try {
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    return decoded.includes('@') ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * Google-Kalender werden als Abo-Link weitergegeben
 * («calendar.google.com/calendar/u/0?cid=…»), und den hat man zur Hand. Ein
 * Feed ist das nicht; daraus wird die öffentliche iCal-Adresse gebaut. Für
 * nicht öffentliche Kalender führt weiterhin nur die geheime Adresse aus den
 * Kalendereinstellungen zum Ziel.
 */
export function googleIcsUrl(u: URL): string | null {
  if (!/(^|\.)calendar\.google\.com$/i.test(u.hostname)) return null;
  if (u.pathname.includes('/ical/')) return null;
  const raw = u.searchParams.get('cid') ?? u.searchParams.get('src');
  const id = raw ? googleCalendarId(raw) : null;
  if (!id) return null;
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(id)}/public/basic.ics`;
}

export function isAllowedIcsUrl(raw: string): { ok: true; url: string } | { ok: false; reason: string } {
  const trimmed = raw.trim().replace(/^webcal:\/\//i, 'https://');
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'Keine gültige Adresse' };
  }
  if (u.protocol !== 'https:') return { ok: false, reason: 'Nur https-Adressen werden unterstützt' };
  return { ok: true, url: googleIcsUrl(u) ?? u.toString() };
}
