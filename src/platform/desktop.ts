import { isTauri } from './env';

/** Fenster- und Systemfunktionen, die es nur in der Desktop-App gibt */

export async function setAlwaysOnTop(on: boolean): Promise<void> {
  if (!isTauri) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().setAlwaysOnTop(on);
}

export async function setAutostart(on: boolean): Promise<boolean> {
  if (!isTauri) return on;
  try {
    const auto = await import('@tauri-apps/plugin-autostart');
    if (on) await auto.enable();
    else await auto.disable();
    return await auto.isEnabled();
  } catch {
    return false;
  }
}

export async function hideWindow(): Promise<void> {
  if (!isTauri) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().hide();
}

export type TrayCommand = 'refresh' | 'settings';

/** Meldungen aus dem Tray-Menü (Rust) */
export async function onTrayCommand(handler: (cmd: TrayCommand) => void): Promise<() => void> {
  if (!isTauri) return () => undefined;
  const { listen } = await import('@tauri-apps/api/event');
  const un = await listen<TrayCommand>('zentime://tray', (e) => handler(e.payload));
  return un;
}

/** Wird nach dem ersten Rendern aufgerufen, damit das Fenster ohne Flackern erscheint */
export async function showWindowWhenReady(): Promise<void> {
  if (!isTauri) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  const w = getCurrentWindow();
  await w.show();
}
