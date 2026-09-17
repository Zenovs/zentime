import { ChevronLeft } from 'lucide-react';
import { useState } from 'react';
import { engine } from '../app/engine';
import { useAppStore } from '../app/store';
import { newSourceId, secretKeys, type GraphSourceConfig, type IcsSourceConfig } from '../model/settings';
import { describeError, log } from '../platform/log';
import { isTauri } from '../platform/env';
import { secrets } from '../platform/secrets';
import { resolveTenantId } from '../platform/tenant';
import { Button, Field, IconButton, Segmented, ViewHeader } from './ui';

type Kind = 'graph' | 'ics';

const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const TENANT_ALIAS = new Set(['common', 'organizations', 'consumers']);
const DOMAIN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

/** Nimmt auch eingefügten Text wie «Anwendungs-ID (Client): 1234…» an */
export function extractGuid(input: string): string | null {
  const m = GUID.exec(input);
  return m ? m[0].toLowerCase() : null;
}

/** Tenant als GUID, Domäne (firma.onmicrosoft.com) oder Alias (organizations) */
export function normalizeTenant(input: string): string | null {
  const guid = extractGuid(input);
  if (guid) return guid;
  const t = input.trim().toLowerCase();
  if (TENANT_ALIAS.has(t) || DOMAIN.test(t)) return t;
  return null;
}

export function AddSourceView({ initialKind }: { initialKind?: Kind | undefined }) {
  const setView = useAppStore((s) => s.setView);
  const upsertSource = useAppStore((s) => s.upsertSource);
  const sources = useAppStore((s) => s.settings.sources);

  const [kind, setKind] = useState<Kind>(initialKind ?? 'graph');
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [email, setEmail] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const back = () => setView(sources.length > 0 ? { name: 'settings' } : { name: 'today' });

  async function addGraph() {
    setError(null);
    const client = extractGuid(clientId);
    if (!client) {
      setError('Client-ID: keine GUID gefunden. Sie steht in Entra ID unter «Anwendungs-ID (Client)».');
      return;
    }
    setBusy(true);
    const id = newSourceId();
    let draft: { id: string; clientId: string; tenantId: string } | null = null;
    try {
      let tenant: string | null;
      if (advanced && tenantId.trim()) {
        tenant = normalizeTenant(tenantId);
        if (!tenant) throw new Error('Tenant-ID: GUID oder Domäne eingeben, z. B. firma.onmicrosoft.com.');
      } else {
        setStatus('Verzeichnis wird ermittelt …');
        tenant = await resolveTenantId(email);
      }
      draft = { id, clientId: client, tenantId: tenant };
      setStatus('Browser geöffnet, bitte dort anmelden …');
      const hint = email.includes('@') ? email.trim() : undefined;
      const { account, calendars } = await engine.loginGraph(draft, hint);
      const cfg: GraphSourceConfig = {
        id,
        kind: 'graph',
        name: name.trim() || 'Arbeit',
        clientId: draft.clientId,
        tenantId: draft.tenantId,
        account: account ?? hint ?? null,
        calendars: calendars.map((c) => ({ id: c.id, name: c.name, enabled: c.isDefaultCalendar === true || calendars.length === 1 })),
      };
      upsertSource(cfg);
      void engine.refreshSource(id, true);
      setView({ name: 'source', id });
    } catch (e) {
      // Kein halb eingerichtetes Konto zurücklassen: Token aus dem Schlüsselbund entfernen
      if (draft) await engine.discardGraphDraft(draft).catch(() => undefined);
      log.warn(`Quelle hinzufügen (Microsoft): ${describeError(e)}`);
      setError(describeError(e));
    } finally {
      setStatus(null);
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
          <Field label="Client-ID der App-Registrierung" value={clientId} onChange={setClientId} placeholder="00000000-0000-0000-0000-000000000000" />
          <Field
            label="E-Mail-Adresse (Arbeits- oder Schulkonto)"
            value={email}
            onChange={setEmail}
            placeholder="vorname@firma.ch"
            type="email"
            inputMode="email"
          />
          <Field label="Anzeigename" value={name} onChange={setName} placeholder="Arbeit" />
          {advanced ? (
            <Field
              label="Tenant-ID (optional)"
              value={tenantId}
              onChange={setTenantId}
              placeholder="GUID oder firma.onmicrosoft.com"
              hint="Nur nötig, wenn das Verzeichnis nicht aus der E-Mail-Domäne ermittelt werden kann."
            />
          ) : (
            <button type="button" onClick={() => setAdvanced(true)} className="self-start text-[13px] leading-4 text-muted hover:text-fg">
              Erweitert: Tenant-ID selbst eintragen
            </button>
          )}
          <p className="text-[13px] leading-[18px] text-muted">
            Die Client-ID stammt aus der einmaligen App-Registrierung in Entra ID (docs/setup-microsoft.md, mit Befehl für die Azure
            Cloud Shell). Das Verzeichnis wird aus der E-Mail-Domäne ermittelt; der Login öffnet den Systembrowser.
          </p>
          {status ? <p className="text-[13px] leading-[18px] text-muted">{status}</p> : null}
          {error ? <p className="text-[13px] leading-[18px] text-fg">{error}</p> : null}
          <Button
            type="submit"
            busy={busy}
            disabled={!isTauri || clientId.trim().length === 0 || (!advanced && email.trim().length === 0)}
          >
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
            Bei einem öffentlichen Google-Kalender genügt der Link aus «Teilen» («calendar.google.com/…?cid=…»), zentime macht
            daraus den Feed. Sonst: Google Kalender → Einstellungen → «Kalender integrieren» → «Geheime Adresse im iCal-Format».
            Auch Planbar und andere ICS-Feeds funktionieren. Die Adresse wird wie ein Passwort behandelt und nur im
            Schlüsselbund gespeichert.
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
