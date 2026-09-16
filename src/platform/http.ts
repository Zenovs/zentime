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
    return fetch(input, withTimeout);
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

export function isAllowedIcsUrl(raw: string): { ok: true; url: string } | { ok: false; reason: string } {
  const trimmed = raw.trim().replace(/^webcal:\/\//i, 'https://');
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'Keine gültige Adresse' };
  }
  if (u.protocol !== 'https:') return { ok: false, reason: 'Nur https-Adressen werden unterstützt' };
  return { ok: true, url: u.toString() };
}
