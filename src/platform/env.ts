/** Läuft die Oberfläche im Tauri-Fenster oder im Browser (`pnpm dev` ohne Tauri)? */
export const isTauri: boolean = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const isMac: boolean = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Systemzeitzone (IANA) */
export const systemZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Zurich';

export const APP_VERSION: string = (import.meta.env['VITE_APP_VERSION'] as string | undefined) ?? '1.0.0';
