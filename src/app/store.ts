import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { CalendarEvent } from '../model/event';
import { DEFAULT_SETTINGS, type Settings, type SourceConfig } from '../model/settings';

export type SourceStatus = 'idle' | 'loading' | 'ok' | 'error' | 'auth';

export interface SourceRuntime {
  status: SourceStatus;
  /** Kurzer Fehlertext für die Einstellungen, ohne Termininhalte */
  message: string | null;
  syncedAt: number | null;
  events: CalendarEvent[];
  /** Zeitpunkt der nächsten planmässigen Aktualisierung */
  nextDueAt: number;
}

export const EMPTY_RUNTIME: SourceRuntime = {
  status: 'idle',
  message: null,
  syncedAt: null,
  events: [],
  nextDueAt: 0,
};

export type View =
  | { name: 'today' }
  | { name: 'settings' }
  | { name: 'add-source'; kind?: 'graph' | 'ics' }
  | { name: 'source'; id: string };

export interface AppState {
  settings: Settings;
  settingsLoaded: boolean;
  runtime: Record<string, SourceRuntime>;
  view: View;
  selectedEventId: string | null;
  /** Privatmodus (F-19): Titel ausgeblendet, z. B. für Bildschirmfreigaben */
  privateMode: boolean;
  /** Auf die volle Minute ausgerichtete «Jetzt»-Zeit */
  now: number;
  online: boolean;

  setSettingsLoaded(settings: Settings): void;
  patchSettings(patch: Partial<Settings>): void;
  upsertSource(cfg: SourceConfig): void;
  removeSource(id: string): void;
  patchRuntime(id: string, patch: Partial<SourceRuntime>): void;
  dropRuntime(id: string): void;
  setView(view: View): void;
  selectEvent(id: string | null): void;
  setNow(ms: number): void;
  togglePrivateMode(): void;
  setOnline(online: boolean): void;
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set) => ({
    settings: DEFAULT_SETTINGS,
    settingsLoaded: false,
    runtime: {},
    view: { name: 'today' },
    selectedEventId: null,
    privateMode: false,
    now: Date.now(),
    online: typeof navigator === 'undefined' ? true : navigator.onLine,

    setSettingsLoaded: (settings) => set({ settings, settingsLoaded: true }),
    patchSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
    upsertSource: (cfg) =>
      set((s) => {
        const exists = s.settings.sources.some((x) => x.id === cfg.id);
        const sources = exists ? s.settings.sources.map((x) => (x.id === cfg.id ? cfg : x)) : [...s.settings.sources, cfg];
        return { settings: { ...s.settings, sources } };
      }),
    removeSource: (id) =>
      set((s) => {
        const runtime = { ...s.runtime };
        delete runtime[id];
        return { settings: { ...s.settings, sources: s.settings.sources.filter((x) => x.id !== id) }, runtime };
      }),
    patchRuntime: (id, patch) =>
      set((s) => ({ runtime: { ...s.runtime, [id]: { ...(s.runtime[id] ?? EMPTY_RUNTIME), ...patch } } })),
    dropRuntime: (id) =>
      set((s) => {
        const runtime = { ...s.runtime };
        delete runtime[id];
        return { runtime };
      }),
    setView: (view) => set({ view }),
    selectEvent: (id) => set({ selectedEventId: id }),
    setNow: (ms) => set({ now: ms }),
    togglePrivateMode: () => set((s) => ({ privateMode: !s.privateMode })),
    setOnline: (online) => set({ online }),
  })),
);

/** Alle Termine aller Quellen, unsortiert (die Logik sortiert) */
export function selectAllEvents(state: Pick<AppState, 'runtime' | 'settings'>): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const src of state.settings.sources) {
    const rt = state.runtime[src.id];
    if (rt) out.push(...rt.events);
  }
  return out;
}

export function sourceIndex(settings: Settings, sourceId: string): number {
  return settings.sources.findIndex((s) => s.id === sourceId);
}
