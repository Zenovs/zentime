export type ThemeMode = 'system' | 'light' | 'dark';

export interface GraphCalendarConfig {
  id: string;
  name: string;
  enabled: boolean;
}

export interface GraphSourceConfig {
  id: string;
  kind: 'graph';
  name: string;
  clientId: string;
  tenantId: string;
  /** Angemeldetes Konto (nur Anzeige) */
  account: string | null;
  calendars: GraphCalendarConfig[];
}

/** Die URL liegt ausschliesslich im Schlüsselbund unter `ics:${id}` */
export interface IcsSourceConfig {
  id: string;
  kind: 'ics';
  name: string;
}

export type SourceConfig = GraphSourceConfig | IcsSourceConfig;

export interface Settings {
  theme: ThemeMode;
  alwaysOnTop: boolean;
  autostart: boolean;
  hideDeclined: boolean;
  sources: SourceConfig[];
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  alwaysOnTop: false,
  autostart: false,
  hideDeclined: true,
  sources: [],
};

/** Gedämpfte Töne für die Kalender-Markierung (F-18), gleiche Helligkeit und Chroma */
export const SOURCE_COLORS = ['#7A93B3', '#8FA986', '#B39A7A', '#A98FA9', '#7AB3A6', '#B37A7A'] as const;

export function sourceColor(index: number): string {
  return SOURCE_COLORS[((index % SOURCE_COLORS.length) + SOURCE_COLORS.length) % SOURCE_COLORS.length] ?? SOURCE_COLORS[0];
}

export function newSourceId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Schlüsselbund-Schlüssel */
export const secretKeys = {
  icsUrl: (sourceId: string) => `ics:${sourceId}:url`,
  graphRefreshToken: (sourceId: string) => `graph:${sourceId}:refresh_token`,
};

export function isSettings(v: unknown): v is Settings {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return Array.isArray(s['sources']) && typeof s['theme'] === 'string';
}

/** Ergänzt fehlende Felder aus älteren Versionen der Datei */
export function normalizeSettings(v: unknown): Settings {
  if (!isSettings(v)) return { ...DEFAULT_SETTINGS };
  return {
    ...DEFAULT_SETTINGS,
    ...v,
    sources: v.sources.filter((s): s is SourceConfig => !!s && typeof s === 'object' && 'kind' in s && 'id' in s),
  };
}
