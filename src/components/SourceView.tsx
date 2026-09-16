import { ChevronLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { engine } from '../app/engine';
import { useAppStore } from '../app/store';
import { formatTime } from '../logic/day';
import { describeError } from '../platform/log';
import { systemZone } from '../platform/env';
import { Button, Field, IconButton, SectionLabel, Toggle, ViewHeader } from './ui';

export function SourceView({ id }: { id: string }) {
  const cfg = useAppStore((s) => s.settings.sources.find((x) => x.id === id));
  const rt = useAppStore((s) => s.runtime[id]);
  const setView = useAppStore((s) => s.setView);
  const upsertSource = useAppStore((s) => s.upsertSource);
  const [busy, setBusy] = useState<'login' | 'remove' | 'calendars' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!cfg) setView({ name: 'settings' });
  }, [cfg, setView]);

  if (!cfg) return null;

  const back = () => setView({ name: 'settings' });

  async function relogin() {
    if (!cfg || cfg.kind !== 'graph') return;
    setError(null);
    setBusy('login');
    try {
      const { account, calendars } = await engine.loginGraph(cfg, cfg.account ?? undefined);
      const known = new Map(cfg.calendars.map((c) => [c.id, c.enabled]));
      upsertSource({
        ...cfg,
        account,
        calendars: calendars.map((c) => ({ id: c.id, name: c.name, enabled: known.get(c.id) ?? c.isDefaultCalendar === true })),
      });
      void engine.refreshSource(cfg.id, true);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  }

  async function reloadCalendars() {
    if (!cfg || cfg.kind !== 'graph') return;
    setError(null);
    setBusy('calendars');
    try {
      const calendars = await engine.listCalendars(cfg);
      const known = new Map(cfg.calendars.map((c) => [c.id, c.enabled]));
      upsertSource({ ...cfg, calendars: calendars.map((c) => ({ id: c.id, name: c.name, enabled: known.get(c.id) ?? false })) });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!cfg) return;
    setBusy('remove');
    try {
      await engine.removeSource(cfg);
      setView({ name: 'settings' });
    } catch (e) {
      setError(describeError(e));
      setBusy(null);
    }
  }

  return (
    <>
      <ViewHeader title={cfg.name} left={<IconButton icon={ChevronLeft} label="Zurück" onClick={back} className="-ml-2" />} />

      <div className="mt-6 flex flex-col gap-4">
        <Field label="Anzeigename" value={cfg.name} onChange={(name) => upsertSource({ ...cfg, name })} />

        <div className="text-[13px] leading-[18px] text-muted">
          {cfg.kind === 'graph' ? `Microsoft 365 · ${cfg.account ?? 'kein Konto'}` : 'ICS-Kalender · Adresse im Schlüsselbund'}
          {rt?.syncedAt ? ` · Stand ${formatTime(rt.syncedAt, systemZone)}` : ''}
          {rt?.status === 'error' && rt.message ? ` · ${rt.message}` : ''}
          {rt?.status === 'auth' ? ' · Anmeldung abgelaufen' : ''}
        </div>

        {cfg.kind === 'graph' ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <SectionLabel>Kalender</SectionLabel>
              <button type="button" onClick={() => void reloadCalendars()} className="text-[13px] leading-4 text-muted hover:text-fg" disabled={busy !== null}>
                {busy === 'calendars' ? 'wird geladen …' : 'Liste aktualisieren'}
              </button>
            </div>
            <div className="flex flex-col">
              {cfg.calendars.length === 0 ? <div className="py-2 text-[15px] leading-5 text-muted">Keine Kalender gefunden</div> : null}
              {cfg.calendars.map((cal) => (
                <div key={cal.id} className="flex items-center justify-between gap-3 py-1.5">
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
              ))}
            </div>
          </div>
        ) : null}

        {error ? <p className="text-[13px] leading-[18px] text-fg">{error}</p> : null}
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-4">
        {cfg.kind === 'graph' ? (
          <Button variant="secondary" busy={busy === 'login'} onClick={() => void relogin()}>
            Neu anmelden
          </Button>
        ) : null}
        {confirmRemove ? (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmRemove(false)}>
              Behalten
            </Button>
            <Button variant="primary" className="flex-1" busy={busy === 'remove'} onClick={() => void remove()}>
              Entfernen
            </Button>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirmRemove(true)}>
            Quelle entfernen
          </Button>
        )}
      </div>
    </>
  );
}
