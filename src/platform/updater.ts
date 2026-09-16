import { APP_VERSION, isTauri } from './env';
import { describeError, log } from './log';

/**
 * Auto-Update über GitHub Releases (F-23). Beim Start und danach täglich wird
 * `latest.json` des neuesten Releases geprüft; ein signiertes Update wird
 * heruntergeladen, installiert und die App neu gestartet.
 */
export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'none'; checkedAt: number }
  | { state: 'downloading'; version: string; percent: number | null }
  | { state: 'installing'; version: string }
  | { state: 'restarting'; version: string }
  | { state: 'error'; message: string; checkedAt: number };

export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60_000;

export async function checkAndInstallUpdate(report: (s: UpdateStatus) => void, now: () => number = Date.now): Promise<void> {
  if (!isTauri) {
    report({ state: 'none', checkedAt: now() });
    return;
  }
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    report({ state: 'checking' });
    const update = await check({ timeout: 20_000 });
    if (!update) {
      report({ state: 'none', checkedAt: now() });
      return;
    }
    log.info(`update: ${APP_VERSION} → ${update.version}`);
    let total = 0;
    let received = 0;
    report({ state: 'downloading', version: update.version, percent: null });
    await update.downloadAndInstall((ev) => {
      if (ev.event === 'Started') {
        total = ev.data.contentLength ?? 0;
      } else if (ev.event === 'Progress') {
        received += ev.data.chunkLength;
        report({
          state: 'downloading',
          version: update.version,
          percent: total > 0 ? Math.min(100, Math.round((received / total) * 100)) : null,
        });
      } else if (ev.event === 'Finished') {
        report({ state: 'installing', version: update.version });
      }
    });
    report({ state: 'restarting', version: update.version });
    log.info(`update: ${update.version} installiert, Neustart`);
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  } catch (e) {
    // z. B. deb-Installation (kein Updater), offline, oder noch kein veröffentlichtes Release
    log.warn(`update: ${describeError(e)}`);
    report({ state: 'error', message: describeError(e), checkedAt: now() });
  }
}

/** Kurztext für Kopfzeile und Einstellungen */
export function updateStatusText(s: UpdateStatus): string | null {
  switch (s.state) {
    case 'checking':
      return 'Suche nach Updates …';
    case 'downloading':
      return s.percent === null ? `Update ${s.version} wird geladen …` : `Update ${s.version} wird geladen … ${s.percent} %`;
    case 'installing':
      return `Update ${s.version} wird installiert …`;
    case 'restarting':
      return `Neustart mit ${s.version} …`;
    default:
      return null;
  }
}
