import { useEffect, useState } from 'react';
import type { ThemeMode } from '../model/settings';

export type ResolvedTheme = 'light' | 'dark';

const query = () => (typeof window === 'undefined' ? null : window.matchMedia('(prefers-color-scheme: dark)'));

export function resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (mode === 'system') return systemDark ? 'dark' : 'light';
  return mode;
}

/** Hell/Dunkel folgt dem System und ist manuell übersteuerbar (F-09) */
export function useResolvedTheme(mode: ThemeMode): ResolvedTheme {
  const [systemDark, setSystemDark] = useState(() => query()?.matches ?? false);
  useEffect(() => {
    const q = query();
    if (!q) return;
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    q.addEventListener('change', handler);
    return () => q.removeEventListener('change', handler);
  }, []);
  const resolved = resolveTheme(mode, systemDark);
  useEffect(() => {
    document.documentElement.dataset['theme'] = resolved;
  }, [resolved]);
  return resolved;
}

/** Klick auf das Sonne/Mond-Icon: auf das Gegenteil der aktuellen Darstellung schalten */
export function toggledTheme(current: ResolvedTheme): ThemeMode {
  return current === 'dark' ? 'light' : 'dark';
}
