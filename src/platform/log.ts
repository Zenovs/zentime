import { isTauri } from './env';

/**
 * Lokales Log ohne Termininhalte (Pflichtenheft 8). Es werden nur technische
 * Meldungen, Quellen-IDs und HTTP-Status geschrieben, nie Titel, Orte oder URLs.
 */
type Level = 'info' | 'warn' | 'error';

async function write(level: Level, message: string): Promise<void> {
  if (isTauri) {
    try {
      const log = await import('@tauri-apps/plugin-log');
      await log[level](message);
      return;
    } catch {
      // fällt auf die Konsole zurück
    }
  }
  console[level](`[zentime] ${message}`);
}

export const log = {
  info: (m: string) => void write('info', m),
  warn: (m: string) => void write('warn', m),
  error: (m: string) => void write('error', m),
};

/** Kürzt Fehlermeldungen auf das Nötige, damit keine URLs oder Tokens ins Log geraten */
export function describeError(e: unknown): string {
  if (e instanceof Error) return e.message.replace(/https?:\/\/\S+/g, '<url>').slice(0, 200);
  if (typeof e === 'string') return e.replace(/https?:\/\/\S+/g, '<url>').slice(0, 200);
  return 'unbekannter Fehler';
}
