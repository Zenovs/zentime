import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { engine } from '../app/engine';
import { useAppStore } from '../app/store';
import { newSourceId, secretKeys, type GraphSourceConfig, type IcsSourceConfig } from '../model/settings';
import { describeError } from '../platform/log';
import { isTauri } from '../platform/env';
import { secrets } from '../platform/secrets';
import { Button, Field, IconButton, Segmented, ViewHeader } from './ui';

type Kind = 'graph' | 'ics';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function AddSourceView({ initialKind }: { initialKind?: Kind | undefined }) {
  const setView = useAppStore((s) => s.setView);
  const upsertSource = useAppStore((s) => s.upsertSource);
  const sources = useAppStore((s) => s.settings.sources);

  const [kind, setKind] = useState<Kind>(initialKind ?? 'graph');
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = () => setView(sources.length > 0 ? { name: 'settings' } : { name: 'today' });

  async function addGraph() {
    setError(null);
    if (!GUID.test(clientId.trim()) || !GUID.test(tenantId.trim())) {
      setError('Client-ID und Tenant-ID müssen GUIDs sein (8-4-4-4-12).');
      return;
    }
    setBusy(true);
    const id = newSourceId();
    const draft = { id, clientId: clientId.trim(), tenantId: tenantId.trim() };
    try {
      const { account, calendars } = await engine.loginGraph(draft);
      const cfg: GraphSourceConfig = {
        id,
        kind: 'graph',
        name: name.trim() || 'Arbeit',
        clientId: draft.clientId,
        tenantId: draft.tenantId,
        account,
        calendars: calendars.map((c) => ({ id: c.id, name: c.name, enabled: c.isDefaultCalendar === true || calendars.length === 1 })),
      };
      upsertSource(cfg);
      void engine.refreshSource(id, true);
      setView({ name: 'source', id });
    } catch (e) {
      // Kein halb eingerichtetes Konto zurücklassen: Token aus dem Schlüsselbund entfernen
      await engine.discardGraphDraft(draft).catch(() => undefined);
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function addIcs() {
    setError(null);
    setBusy(true);
    try {
      const probe = await engine.probeIcs(url, name.trim() || 'Kalender');
      const id = newSourceId();
      await secrets.set(secretKeys.icsUrl(id), probe.url);
      const cfg: IcsSourceConfig = { id, kind: 'ics', name: name.trim() || probe.calendarName || 'Kalender' };
      upsertSource(cfg);
      void engine.refreshSource(id, true);
      setView({ name: 'settings' });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ViewHeader title="Quelle hinzufügen" left={<IconButton icon={ChevronLeft} label="Zurück" onClick={back} className="-ml-2" />} />

      <div className="mt-6">
        <Segmented
          options={[
            { value: 'graph', label: 'Microsoft 365' },
            { value: 'ics', label: 'ICS-Kalender' },
          ]}
          value={kind}
          onChange={(k) => {
            setKind(k);
            setError(null);
          }}
          label="Art der Quelle"
          className="h-9"
        />
      </div>

      {kind === 'graph' ? (
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void addGraph();
          }}
        >
          <Field label="Anzeigename" value={name} onChange={setName} placeholder="Arbeit" />
          <Field label="Client-ID" value={clientId} onChange={setClientId} placeholder="00000000-0000-0000-0000-000000000000" />
          <Field label="Tenant-ID" value={tenantId} onChange={setTenantId} placeholder="00000000-0000-0000-0000-000000000000" />
          <p className="text-[13px] leading-[18px] text-muted">
            Beide Werte stammen aus der App-Registrierung in Entra ID (docs/setup-microsoft.md). Ein Client-Secret ist nicht nötig;
            der Login öffnet den Systembrowser.
          </p>
          {error ? <p className="text-[13px] leading-[18px] text-fg">{error}</p> : null}
          <Button type="submit" busy={busy} disabled={!isTauri}>
            Mit Microsoft anmelden
          </Button>
          {!isTauri ? <p className="text-[13px] leading-[18px] text-muted">Die Anmeldung ist nur in der Desktop-App möglich.</p> : null}
        </form>
      ) : (
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void addIcs();
          }}
        >
          <Field label="Anzeigename" value={name} onChange={setName} placeholder="Privat" />
          <Field
            label="ICS-Adresse"
            value={url}
            onChange={setUrl}
            placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
            type="url"
            inputMode="url"
          />
          <p className="text-[13px] leading-[18px] text-muted">
            Google Kalender → Einstellungen → «Kalender integrieren» → «Geheime Adresse im iCal-Format». Auch Planbar und andere
            ICS-Feeds funktionieren. Die Adresse wird wie ein Passwort behandelt und nur im Schlüsselbund gespeichert.
          </p>
          {error ? <p className="text-[13px] leading-[18px] text-fg">{error}</p> : null}
          <Button type="submit" busy={busy} disabled={url.trim().length === 0}>
            Kalender hinzufügen
          </Button>
        </form>
      )}
    </>
  );
}
