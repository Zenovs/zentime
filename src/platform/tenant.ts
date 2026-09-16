import { openIdConfigUrl, tenantIdFromOpenIdConfig } from '../sources/msauth';
import { httpFetch, type HttpFetch } from './http';

/** Persönliche Microsoft-Konten haben keinen Organisations-Tenant */
const CONSUMER_DOMAINS = new Set(['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'outlook.de', 'hotmail.de', 'live.de']);

export function domainOf(emailOrDomain: string): string | null {
  const v = emailOrDomain.trim().toLowerCase();
  const domain = v.includes('@') ? v.split('@').pop() ?? '' : v;
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(domain) ? domain : null;
}

/**
 * Ermittelt die Tenant-ID über Microsofts öffentliche OpenID-Konfiguration der
 * Domäne. So muss niemand die «Verzeichnis-ID (Mandant)» heraussuchen.
 */
export async function resolveTenantId(emailOrDomain: string, http: HttpFetch = httpFetch): Promise<string> {
  const domain = domainOf(emailOrDomain);
  if (!domain) throw new Error('Bitte eine gültige E-Mail-Adresse des Arbeits- oder Schulkontos eingeben.');
  if (CONSUMER_DOMAINS.has(domain)) {
    throw new Error('Persönliche Microsoft-Konten werden nicht unterstützt. Bitte das Arbeits- oder Schulkonto verwenden.');
  }
  const res = await http(openIdConfigUrl(domain), { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Für «${domain}» wurde kein Microsoft-365-Verzeichnis gefunden. Unter «Erweitert» kann die Tenant-ID direkt eingetragen werden.`);
  }
  const json = (await res.json().catch(() => ({}))) as unknown;
  const tenant = tenantIdFromOpenIdConfig(json);
  if (!tenant) throw new Error('Antwort des Anmeldediensts nicht lesbar.');
  return tenant;
}
