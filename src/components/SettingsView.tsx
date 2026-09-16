import { ChevronRight, Plus, RefreshCw, TriangleAlert, X } from 'lucide-react';
import { engine } from '../app/engine';
import { runUpdateCheck } from '../app/update';
import { sourceIndex, useAppStore, type SourceRuntime } from '../app/store';
import { formatTime } from '../logic/day';
import { APP_VERSION, isTauri, systemZone } from '../platform/env';
import { setAlwaysOnTop, setAutostart } from '../platform/desktop';
import { updateStatusText, type UpdateStatus } from '../platform/updater';
import type { SourceConfig, ThemeMode } from '../model/settings';
import { sourceColor } from '../model/settings';
import { Dot, IconButton, SectionLabel, Segmented, Toggle, ViewHeader } from './ui';

function statusText(cfg: SourceConfig, rt: SourceRuntime | undefined, now: number): { text: string; alert: boolean } {
  const kind = cfg.kind === 'graph' ? (cfg.account ?? 'Microsoft 365') : 'ICS';
  if (!rt || rt.status === 'idle') return { text: `${kind} · noch nicht geladen`, alert: false };
  if (rt.status === 'loading') return { text: `${kind} · wird geladen …`, alert: false };
  if (rt.status === 'auth') return { text: `${kind} · Anmeldung abgelaufen`, alert: true };
  if (rt.status === 'error') return { text: `${kind} · ${rt.message ?? 'Fehler'}`, alert: true };
  const ago = rt.syncedAt ? Math.max(0, Math.round((now - rt.syncedAt) / 60_000)) : null;
  const when = ago === null ? '' : ago === 0 ? 'gerade aktualisiert' : `vor ${ago} min aktualisiert`;
  return { text: `${kind} · ${when}`, alert: false };
}

function updateSummary(s: UpdateStatus): string {
  const running = updateStatusText(s);
  if (running) return running;
  if (s.state === 'none') return `Aktuell (geprüft ${formatTime(s.checkedAt, systemZone)})`;
  if (s.state === 'error') return `Prüfung fehlgeschlagen: ${s.message}`;
  return 'Noch nicht geprüft';
}

export function SettingsView() {
  const settings = useAppStore((s) => s.settings);
  const runtime = useAppStore((s) => s.runtime);
  const now = useAppStore((s) => s.now);
  const updateStatus = useAppStore((s) => s.updateStatus);
  const setView = useAppStore((s) => s.setView);
  const patchSettings = useAppStore((s) => s.patchSettings);
  const upsertSource = useAppStore((s) => s.upsertSource);

  const themeOptions: ReadonlyArray<{ value: ThemeMode; label: string }> = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Hell' },
    { value: 'dark', label: 'Dunkel' },
  ];

  const updateBusy = updateStatus.state === 'checking' || updateStatus.state === 'downloading' || updateStatus.state === 'installing';

  return (
    <>
      <ViewHeader
        title="Einstellungen"
        right={
          <div className="-mr-1.5 flex items-center">
            <IconButton icon={RefreshCw} label="Alle Quellen aktualisieren" onClick={() => void engine.refreshAll(true)} />
            <IconButton icon={X} label="Schliessen" onClick={() => setView({ name: 'today' })} />
          </div>
        }
      />

      <div className="mt-6 flex flex-col gap-2">
        <SectionLabel>Quellen</SectionLabel>
        <div className="flex flex-col">
          {settings.sources.map((cfg, i) => {
            const st = statusText(cfg, runtime[cfg.id], now);
            return (
              <div key={cfg.id} className={i > 0 ? 'border-t border-line' : ''}>
                <button
                  type="button"
                  onClick={() => setView({ name: 'source', id: cfg.id })}
                  className="flex w-full items-center gap-3 py-2 text-left"
                >
                  <Dot color={sourceColor(sourceIndex(settings, cfg.id))} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="truncate text-[15px] leading-5 font-semibold">{cfg.name}</div>
                    <div className={`truncate text-[13px] leading-4 ${st.alert ? 'text-fg' : 'text-muted'}`}>{st.text}</div>
                  </div>
                  {st.alert ? (
                    <TriangleAlert size={20} strokeWidth={1.5} className="flex-none text-fg" aria-hidden />
                  ) : (
                    <ChevronRight size={20} strokeWidth={1.5} className="flex-none text-muted" aria-hidden />
                  )}
                </button>
                {cfg.kind === 'graph'
                  ? cfg.calendars.map((cal) => (
                      <div key={cal.id} className="flex items-center justify-between gap-3 py-1 pl-5">
                        <span className="truncate text-[15px] leading-5">{cal.name}</span>
                        <Toggle
                          checked={cal.enabled}
                          label={`Kalender ${cal.name} anzeigen`}
                          onChange={(on) => {
                            upsertSource({ ...cfg, calendars: cfg.calendars.map((c) => (c.id === cal.id ? { ...c, enabled: on } : c)) });
                            void engine.refreshSource(cfg.id, true);
                          }}
                        />
                      </div>
                    ))
                  : null}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setView({ name: 'add-source' })}
            className={`flex items-center gap-3 py-3 text-left ${settings.sources.length > 0 ? 'border-t border-line' : ''}`}
          >
            <Plus size={20} strokeWidth={1.5} aria-hidden />
            <span className="text-[15px] leading-5 font-semibold">Quelle hinzufügen</span>
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <SectionLabel>Darstellung</SectionLabel>
        <Segmented options={themeOptions} value={settings.theme} onChange={(theme) => patchSettings({ theme })} label="Erscheinungsbild" />
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="text-[15px] leading-5">Immer im Vordergrund</span>
            <Toggle
              checked={settings.alwaysOnTop}
              label="Immer im Vordergrund"
              onChange={(on) => {
                patchSettings({ alwaysOnTop: on });
                void setAlwaysOnTop(on);
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="text-[15px] leading-5">Beim Anmelden starten</span>
            <Toggle
              checked={settings.autostart}
              label="Beim Anmelden starten"
              disabled={!isTauri}
              onChange={(on) => {
                void setAutostart(on).then((actual) => patchSettings({ autostart: actual }));
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="text-[15px] leading-5">Abgelehnte Termine ausblenden</span>
            <Toggle checked={settings.hideDeclined} label="Abgelehnte Termine ausblenden" onChange={(on) => patchSettings({ hideDeclined: on })} />
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <SectionLabel>Updates</SectionLabel>
        <div className="flex items-center justify-between gap-3 py-2">
          <span className="text-[15px] leading-5">Automatisch aktualisieren</span>
          <Toggle checked={settings.autoUpdate} label="Updates automatisch installieren" onChange={(on) => patchSettings({ autoUpdate: on })} />
        </div>
        <div className="flex items-center justify-between gap-3 text-[13px] leading-[18px] text-muted">
          <span className="truncate">{updateSummary(updateStatus)}</span>
          <button
            type="button"
            onClick={() => void runUpdateCheck()}
            disabled={!isTauri || updateBusy}
            className="flex-none font-semibold text-fg hover:text-muted disabled:opacity-50"
          >
            Jetzt prüfen
          </button>
        </div>
      </div>

      <div className="mt-auto pt-4 text-[13px] leading-[18px] text-muted">
        zentime {APP_VERSION} · {systemZone}
        {now ? ` · ${formatTime(now, systemZone)}` : ''}
      </div>
    </>
  );
}
