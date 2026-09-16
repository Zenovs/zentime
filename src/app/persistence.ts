import { normalizeSettings, type Settings } from '../model/settings';
import { settingsStore } from '../platform/kv';
import { describeError, log } from '../platform/log';
import { useAppStore } from './store';

const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await settingsStore.get<unknown>(KEY);
    return normalizeSettings(raw);
  } catch (e) {
    log.warn(`Einstellungen lesen fehlgeschlagen: ${describeError(e)}`);
    return normalizeSettings(undefined);
  }
}

/** Schreibt Einstellungen bei jeder Änderung (ohne Secrets, die liegen im Schlüsselbund) */
export function persistSettings(): () => void {
  return useAppStore.subscribe(
    (s) => s.settings,
    (settings, prev) => {
      if (!useAppStore.getState().settingsLoaded || settings === prev) return;
      void settingsStore.set(KEY, settings).catch((e) => log.warn(`Einstellungen speichern fehlgeschlagen: ${describeError(e)}`));
    },
  );
}
