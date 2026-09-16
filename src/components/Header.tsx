import { EyeOff, Moon, Settings, Sun, TriangleAlert } from 'lucide-react';
import { formatLongDate, formatTime } from '../logic/day';
import type { ResolvedTheme } from '../app/theme';
import { IconButton } from './ui';

interface HeaderProps {
  now: number;
  zone: string;
  theme: ResolvedTheme;
  stale: boolean;
  latestSync: number | null;
  hasError: boolean;
  privateMode: boolean;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onTogglePrivate: () => void;
}

export function Header(p: HeaderProps) {
  const ThemeIcon = p.theme === 'dark' ? Sun : Moon;
  const stand = p.stale && p.latestSync ? ` · Stand ${formatTime(p.latestSync, p.zone)}` : '';
  return (
    <header data-tauri-drag-region className="flex items-start justify-between gap-4">
      <div data-tauri-drag-region className="flex min-w-0 flex-col gap-1">
        <h1 data-tauri-drag-region className="text-[20px] leading-6 font-semibold">
          Heute
        </h1>
        <div data-tauri-drag-region className="truncate text-[13px] leading-[18px] text-muted">
          {formatLongDate(p.now, p.zone)}
          {stand}
        </div>
      </div>
      <div className="-mr-1.5 -mt-1.5 flex items-center">
        {p.privateMode ? <IconButton icon={EyeOff} label="Privatmodus beenden" onClick={p.onTogglePrivate} /> : null}
        {p.hasError ? (
          <IconButton icon={TriangleAlert} label="Eine Quelle meldet einen Fehler, Einstellungen öffnen" onClick={p.onOpenSettings} muted={false} />
        ) : null}
        <IconButton icon={Settings} label="Einstellungen" onClick={p.onOpenSettings} />
        <IconButton icon={ThemeIcon} label={p.theme === 'dark' ? 'Helle Darstellung' : 'Dunkle Darstellung'} onClick={p.onToggleTheme} />
      </div>
    </header>
  );
}
