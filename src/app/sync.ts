import { dayKey, fetchWindow, growRange, rangeCovers } from '../logic/day';
import type { CalendarEvent } from '../model/event';
import { secretKeys, type GraphSourceConfig, type IcsSourceConfig, type SourceConfig } from '../model/settings';
import { fetchCalendarView, fetchCalendars, type GraphCalendarRaw } from '../sources/graph';
import { parseIcs } from '../sources/ics';
import { mergeEvents } from '../sources/merge';
import { AuthRequiredError, GraphSession } from '../platform/graphClient';
import { HttpError, httpFetch, isAllowedIcsUrl, retryAfterMs, type HttpFetch } from '../platform/http';
import { cacheStore, type KeyValueStore } from '../platform/kv';
import { describeError, log } from '../platform/log';
import { secrets, type SecretStore } from '../platform/secrets';
import { EMPTY_RUNTIME, useAppStore } from './store';

export const GRAPH_INTERVAL_MS = 5 * 60_000;
export const ICS_INTERVAL_MS = 15 * 60_000;
const ERROR_BACKOFF_MS = 2 * 60_000;
const TICK_MS = 30_000;
/** Ein grösserer Sprung zwischen zwei Ticks bedeutet Standby (F-08) */
const WAKE_JUMP_MS = 90_000;

interface IcsCacheEntry {
  kind: 'ics';
  syncedAt: number;
  etag: string | null;
  text: string;
}

interface GraphCacheEntry {
  kind: 'graph';
  syncedAt: number;
  events: CalendarEvent[];
}

type CacheEntry = IcsCacheEntry | GraphCacheEntry;

interface LoadResult {
  events: CalendarEvent[];
  cache: CacheEntry;
}

interface Deps {
  http: HttpFetch;
  secrets: SecretStore;
  cache: KeyValueStore;
  zone: string;
  now: () => number;
}

/**
 * Lädt die Quellen nach Zeitplan (Graph 5 min, ICS 15 min), pflegt den
 * Offline-Cache und reagiert auf Tageswechsel, Standby und Netzwerkstatus.
 */
export class SyncEngine {
  private sessions = new Map<string, GraphSession>();
  private icsRaw = new Map<string, { text: string; etag: string | null }>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTick: number;
  private currentDay: string;
  private inFlight = new Map<string, Promise<void>>();
  private teardown: Array<() => void> = [];

  constructor(
    private readonly deps: Deps = {
      http: httpFetch,
      secrets,
      cache: cacheStore,
      zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      now: Date.now,
    },
  ) {
    this.lastTick = deps.now();
    this.currentDay = dayKey(this.lastTick, deps.zone);
  }

  private get store() {
    return useAppStore.getState();
  }

  /** Ist die Quelle (noch) konfiguriert? Schutz vor Schreibzugriffen nach dem Entfernen. */
  private configured(id: string): SourceConfig | undefined {
    return this.store.settings.sources.find((s) => s.id === id);
  }

  async start(): Promise<void> {
    await this.loadCache();
    this.timer = setInterval(() => void this.tick(), TICK_MS);

    const onWake = () => void this.tick();
    const onOnline = () => {
      this.store.setOnline(true);
      void this.refreshAll(true);
    };
    const onOffline = () => this.store.setOnline(false);
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    this.teardown.push(
      () => window.removeEventListener('focus', onWake),
      () => document.removeEventListener('visibilitychange', onWake),
      () => window.removeEventListener('online', onOnline),
      () => window.removeEventListener('offline', onOffline),
    );

    await this.refreshAll(true);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const fn of this.teardown) fn();
    this.teardown = [];
  }

  /** Alle 30 s: fällige Quellen laden, Standby und Tageswechsel erkennen */
  async tick(): Promise<void> {
    const now = this.deps.now();
    const jumped = now - this.lastTick > WAKE_JUMP_MS;
    this.lastTick = now;

    const day = dayKey(now, this.deps.zone);
    if (day !== this.currentDay) {
      this.currentDay = day;
      log.info('Tageswechsel');
      // Das Tag-Rad zeigte bis eben einen Tag, der nun anders heisst
      this.store.setDayOffset(0);
      this.reparseIcsFromRaw();
      await this.refreshAll(true);
      return;
    }
    if (jumped) {
      log.info('Aufwachen aus Standby erkannt');
      await this.refreshAll(true);
      return;
    }
    const due = this.store.settings.sources.filter((s) => (this.store.runtime[s.id]?.nextDueAt ?? 0) <= now);
    await Promise.allSettled(due.map((s) => this.refreshSource(s.id)));
  }

  async refreshAll(force = false): Promise<void> {
    await Promise.allSettled(this.store.settings.sources.map((s) => this.refreshSource(s.id, force)));
  }

  /**
   * Lädt eine Quelle. Läuft bereits ein Abruf, wird bei `force` ein weiterer
   * angehängt (z. B. nach dem Umschalten eines Kalenders), sonst der laufende geteilt.
   */
  refreshSource(id: string, force = false): Promise<void> {
    const running = this.inFlight.get(id);
    const next = running
      ? force
        ? running.catch(() => undefined).then(() => this.doRefresh(id, true))
        : running
      : this.doRefresh(id, force);
    if (next !== running) {
      const tracked = next.finally(() => {
        if (this.inFlight.get(id) === tracked) this.inFlight.delete(id);
      });
      this.inFlight.set(id, tracked);
      return tracked;
    }
    return running;
  }

  private async doRefresh(id: string, force: boolean): Promise<void> {
    const cfg = this.configured(id);
    if (!cfg) return;
    const now = this.deps.now();
    this.store.patchRuntime(id, { status: 'loading' });
    try {
      const result = cfg.kind === 'ics' ? await this.loadIcs(cfg, force) : await this.loadGraph(cfg);
      // Quelle könnte während des Abrufs entfernt worden sein
      if (!this.configured(id)) return;
      await this.writeCache(id, result.cache);
      this.store.patchRuntime(id, {
        status: 'ok',
        message: null,
        syncedAt: now,
        events: result.events,
        nextDueAt: now + (cfg.kind === 'ics' ? ICS_INTERVAL_MS : GRAPH_INTERVAL_MS),
      });
    } catch (e) {
      if (!this.configured(id)) return;
      const prev = this.store.runtime[id] ?? EMPTY_RUNTIME;
      if (e instanceof AuthRequiredError) {
        log.warn(`${cfg.kind} ${id}: Anmeldung erforderlich`);
        this.store.patchRuntime(id, { status: 'auth', message: e.message, nextDueAt: now + GRAPH_INTERVAL_MS });
        return;
      }
      const retry =
        e instanceof HttpError && e.status === 429 && e.retryAfterMs !== null ? Math.max(e.retryAfterMs, 30_000) : ERROR_BACKOFF_MS;
      log.warn(`${cfg.kind} ${id}: ${describeError(e)}`);
      this.store.patchRuntime(id, {
        status: 'error',
        message: describeError(e),
        nextDueAt: now + retry,
        events: prev.events,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // ICS (Pflichtenheft 5.2)
  // ---------------------------------------------------------------------------

  private async loadIcs(cfg: IcsSourceConfig, force: boolean): Promise<LoadResult> {
    const url = await this.deps.secrets.get(secretKeys.icsUrl(cfg.id));
    if (!url) throw new Error('Adresse fehlt im Schlüsselbund');

    const cached = this.icsRaw.get(cfg.id);
    const headers: Record<string, string> = { Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.8' };
    if (cached?.etag && !force) headers['If-None-Match'] = cached.etag;

    const res = await this.deps.http(url, { headers });
    let text: string;
    let etag: string | null;
    if (res.status === 304 && cached) {
      text = cached.text;
      etag = cached.etag;
    } else {
      if (res.status === 429) throw new HttpError(429, 'Zu viele Anfragen', retryAfterMs(res, this.deps.now()));
      if (!res.ok) throw new HttpError(res.status, `Server antwortete mit ${res.status}`);
      text = await res.text();
      etag = res.headers.get('etag');
      if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('Antwort ist kein Kalender');
    }
    const events = this.parseIcsText(cfg, text);
    this.icsRaw.set(cfg.id, { text, etag });
    return { events, cache: { kind: 'ics', syncedAt: this.deps.now(), etag, text } };
  }

  private parseIcsText(cfg: IcsSourceConfig, text: string): CalendarEvent[] {
    return parseIcs(text, fetchWindow(this.deps.now(), this.deps.zone, this.store.dayRange), {
      sourceId: cfg.id,
      calendarName: cfg.name,
      zone: this.deps.zone,
    });
  }

  /** Nach Mitternacht gilt ein neues Fenster: gespeicherte ICS-Texte neu expandieren */
  private reparseIcsFromRaw(): void {
    for (const cfg of this.store.settings.sources) {
      if (cfg.kind !== 'ics') continue;
      const raw = this.icsRaw.get(cfg.id);
      if (!raw) continue;
      try {
        this.store.patchRuntime(cfg.id, { events: this.parseIcsText(cfg, raw.text) });
      } catch (e) {
        log.warn(`ics ${cfg.id}: erneutes Parsen fehlgeschlagen: ${describeError(e)}`);
      }
    }
  }

  /** Prüft eine neue ICS-Adresse, bevor sie gespeichert wird */
  async probeIcs(rawUrl: string, name: string): Promise<{ url: string; count: number; calendarName: string | null }> {
    const check = isAllowedIcsUrl(rawUrl);
    if (!check.ok) throw new Error(check.reason);
    const res = await this.deps.http(check.url, { headers: { Accept: 'text/calendar' } });
    if (!res.ok) throw new HttpError(res.status, `Server antwortete mit ${res.status}`);
    const text = await res.text();
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('Die Adresse liefert keinen Kalender');
    const events = parseIcs(text, fetchWindow(this.deps.now(), this.deps.zone, this.store.dayRange), {
      sourceId: 'probe',
      calendarName: name,
      zone: this.deps.zone,
    });
    const nameMatch = /^X-WR-CALNAME:(.+)$/im.exec(text);
    return { url: check.url, count: events.length, calendarName: nameMatch?.[1]?.trim() ?? null };
  }

  // ---------------------------------------------------------------------------
  // Microsoft Graph (Pflichtenheft 5.1)
  // ---------------------------------------------------------------------------

  session(cfg: Pick<GraphSourceConfig, 'id' | 'clientId' | 'tenantId'>): GraphSession {
    let s = this.sessions.get(cfg.id);
    if (!s) {
      s = new GraphSession(cfg, { http: this.deps.http, secrets: this.deps.secrets, now: this.deps.now });
      this.sessions.set(cfg.id, s);
    } else {
      s.updateConfig(cfg);
    }
    return s;
  }

  private async loadGraph(cfg: GraphSourceConfig): Promise<LoadResult> {
    const session = this.session(cfg);
    const enabled = cfg.calendars.filter((c) => c.enabled);
    if (enabled.length === 0) {
      await session.getAccessToken();
      return { events: [], cache: { kind: 'graph', syncedAt: this.deps.now(), events: [] } };
    }
    const window = fetchWindow(this.deps.now(), this.deps.zone, this.store.dayRange);
    const lists = await Promise.all(
      enabled.map((c) =>
        fetchCalendarView((url) => session.fetchJson(url), c.id, window, {
          sourceId: cfg.id,
          calendarName: c.name,
          zone: this.deps.zone,
        }),
      ),
    );
    const events = mergeEvents(lists);
    return { events, cache: { kind: 'graph', syncedAt: this.deps.now(), events } };
  }

  /**
   * Tag im Tag-Rad wechseln. Liegt er ausserhalb des geladenen Bereichs, wächst
   * dieser mit: ICS lässt sich sofort aus dem gespeicherten Text neu berechnen,
   * Graph braucht dafür einen Abruf.
   */
  showDay(offset: number): void {
    this.store.setDayOffset(offset);
    const range = this.store.dayRange;
    if (rangeCovers(range, offset)) return;
    const grown = growRange(range, offset);
    this.store.setDayRange(grown);
    log.info(`Tagesbereich erweitert auf ${grown.from} bis ${grown.to}`);
    this.reparseIcsFromRaw();
    for (const cfg of this.store.settings.sources) {
      if (cfg.kind === 'graph') void this.refreshSource(cfg.id, true);
    }
  }

  /** Interaktive Anmeldung und Kalenderliste (Einrichtung oder «Neu anmelden») */
  async loginGraph(cfg: Pick<GraphSourceConfig, 'id' | 'clientId' | 'tenantId'>, loginHint?: string) {
    const session = this.session(cfg);
    const { account } = await session.login(loginHint);
    const calendars = await fetchCalendars((url) => session.fetchJson(url));
    return { account, calendars };
  }

  async listCalendars(cfg: Pick<GraphSourceConfig, 'id' | 'clientId' | 'tenantId'>): Promise<GraphCalendarRaw[]> {
    return fetchCalendars((url) => this.session(cfg).fetchJson(url));
  }

  /** Verwirft eine begonnene, aber nicht gespeicherte Microsoft-Quelle samt Token */
  async discardGraphDraft(cfg: Pick<GraphSourceConfig, 'id' | 'clientId' | 'tenantId'>): Promise<void> {
    await this.session(cfg).logout();
    this.sessions.delete(cfg.id);
  }

  // ---------------------------------------------------------------------------
  // Quellen verwalten
  // ---------------------------------------------------------------------------

  async removeSource(cfg: SourceConfig): Promise<void> {
    // Zuerst aus den Einstellungen nehmen, damit laufende Abrufe nichts mehr schreiben
    this.store.removeSource(cfg.id);
    if (cfg.kind === 'graph') {
      await this.session(cfg).logout();
      this.sessions.delete(cfg.id);
    } else {
      await this.deps.secrets.delete(secretKeys.icsUrl(cfg.id)).catch(() => undefined);
      this.icsRaw.delete(cfg.id);
    }
    await this.deps.cache.delete(cfg.id).catch(() => undefined);
  }

  // ---------------------------------------------------------------------------
  // Offline-Cache (F-07)
  // ---------------------------------------------------------------------------

  private async writeCache(id: string, entry: CacheEntry): Promise<void> {
    if (!this.configured(id)) return;
    try {
      await this.deps.cache.set(id, entry);
    } catch (e) {
      log.warn(`Cache schreiben fehlgeschlagen: ${describeError(e)}`);
    }
  }

  private async loadCache(): Promise<void> {
    for (const cfg of this.store.settings.sources) {
      try {
        const entry = await this.deps.cache.get<CacheEntry>(cfg.id);
        if (!entry) continue;
        if (entry.kind === 'ics' && cfg.kind === 'ics') {
          this.icsRaw.set(cfg.id, { text: entry.text, etag: entry.etag });
          this.store.patchRuntime(cfg.id, {
            events: this.parseIcsText(cfg, entry.text),
            syncedAt: entry.syncedAt,
            status: 'idle',
          });
        } else if (entry.kind === 'graph' && cfg.kind === 'graph') {
          this.store.patchRuntime(cfg.id, { events: entry.events, syncedAt: entry.syncedAt, status: 'idle' });
        }
      } catch (e) {
        log.warn(`Cache lesen fehlgeschlagen: ${describeError(e)}`);
      }
    }
  }
}
