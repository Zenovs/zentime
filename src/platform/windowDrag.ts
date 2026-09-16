import { isTauri } from './env';
import { describeError, log } from './log';

/**
 * Rahmenloses Fenster (F-11): Ziehen an jeder freien Stelle, Grösse ändern an
 * Rändern und Ecken. Schaltflächen, Eingabefelder und Links bleiben bedienbar.
 */

const INTERACTIVE = 'button, a, input, textarea, select, [role="switch"], [role="radio"], [data-no-drag]';

export function installWindowDrag(): () => void {
  if (!isTauri) return () => undefined;
  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (!target || target.closest(INTERACTIVE) || target.closest('[data-resize]')) return;
    e.preventDefault();
    void import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().startDragging())
      .catch((err: unknown) => log.warn(`Fenster ziehen fehlgeschlagen: ${describeError(err)}`));
  };
  window.addEventListener('mousedown', onMouseDown);
  return () => window.removeEventListener('mousedown', onMouseDown);
}

export type ResizeEdge = 'North' | 'South' | 'East' | 'West' | 'NorthEast' | 'NorthWest' | 'SouthEast' | 'SouthWest';

export async function startResize(edge: ResizeEdge): Promise<void> {
  if (!isTauri) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().startResizeDragging(edge);
  } catch (err) {
    log.warn(`Fenster skalieren fehlgeschlagen: ${describeError(err)}`);
  }
}
