import { checkAndInstallUpdate } from '../platform/updater';
import { useAppStore } from './store';

/** Update prüfen und installieren; Status landet im Store (Kopfzeile, Einstellungen) */
export function runUpdateCheck(): Promise<void> {
  return checkAndInstallUpdate((s) => useAppStore.getState().setUpdateStatus(s));
}
