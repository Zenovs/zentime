import { checkAndInstallUpdate } from '../platform/updater';
import { useAppStore } from './store';

/**
 * Update prüfen und installieren; Status landet im Store (Kopfzeile, Einstellungen).
 *
 * Im Dev-Build wird nicht geprüft: dessen Version liegt in der Regel hinter dem
 * neuesten Release, und der Updater würde das frisch gebaute Binary durch das
 * Release ersetzen und die Sitzung beenden.
 */
export function runUpdateCheck(): Promise<void> {
  if ((import.meta.env['DEV'] as boolean | undefined) === true) return Promise.resolve();
  return checkAndInstallUpdate((s) => useAppStore.getState().setUpdateStatus(s));
}
