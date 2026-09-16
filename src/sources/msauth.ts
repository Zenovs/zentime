/**
 * OAuth 2.0 Authorization Code mit PKCE für Microsoft Entra ID (Pflichtenheft 5.1).
 * Reine Funktionen ohne Netzwerk; der HTTP-Teil liegt in `platform/graphClient.ts`.
 */

export const GRAPH_SCOPES = ['openid', 'profile', 'offline_access', 'User.Read', 'Calendars.Read'];

export interface MsAppConfig {
  clientId: string;
  tenantId: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  id_token?: string;
  token_type?: string;
}

export interface TokenError {
  error: string;
  error_description?: string;
  error_codes?: number[];
}

function tenantBaseUrl(tenantId: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId.trim())}`;
}

export function authorityUrl(tenantId: string): string {
  return `${tenantBaseUrl(tenantId)}/oauth2/v2.0`;
}

export function base64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Code-Verifier nach RFC 7636 (43–128 Zeichen) aus 32 Zufallsbytes */
export function codeVerifier(randomBytes: Uint8Array): string {
  return base64Url(randomBytes);
}

/** S256-Challenge: base64url(sha256(verifier)) */
export async function codeChallenge(verifier: string, subtle: SubtleCrypto): Promise<string> {
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export interface AuthorizeParams extends MsAppConfig {
  redirectUri: string;
  state: string;
  challenge: string;
  /** Vorbelegtes Konto, z. B. nach Ablauf des Refresh-Tokens */
  loginHint?: string;
}

export function buildAuthorizeUrl(p: AuthorizeParams): string {
  const params = new URLSearchParams({
    client_id: p.clientId.trim(),
    response_type: 'code',
    redirect_uri: p.redirectUri,
    response_mode: 'query',
    scope: GRAPH_SCOPES.join(' '),
    state: p.state,
    code_challenge: p.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  if (p.loginHint) params.set('login_hint', p.loginHint);
  return `${authorityUrl(p.tenantId)}/authorize?${params.toString()}`;
}

export type RedirectResult = { ok: true; code: string } | { ok: false; error: string; description: string };

/** Wertet die Redirect-URL des Loopback-Listeners aus und prüft den `state` */
export function parseRedirect(url: string, expectedState: string): RedirectResult {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, error: 'invalid_redirect', description: 'Ungültige Redirect-URL' };
  }
  const q = u.searchParams;
  const err = q.get('error');
  if (err) {
    return { ok: false, error: err, description: q.get('error_description') ?? '' };
  }
  if (q.get('state') !== expectedState) {
    return { ok: false, error: 'state_mismatch', description: 'Die Antwort gehört nicht zu dieser Anmeldung' };
  }
  const code = q.get('code');
  if (!code) return { ok: false, error: 'missing_code', description: 'Kein Autorisierungscode erhalten' };
  return { ok: true, code };
}

export function tokenUrl(tenantId: string): string {
  return `${authorityUrl(tenantId)}/token`;
}

/**
 * Öffentliche OpenID-Konfiguration; antwortet mit 400 (AADSTS90002), wenn der
 * Tenant nicht existiert. Sie liegt unter `/{tenant}/v2.0/`, nicht unter
 * `/{tenant}/oauth2/v2.0/` wie die Authorize- und Token-Endpunkte.
 */
export function openIdConfigUrl(tenantId: string): string {
  return `${tenantBaseUrl(tenantId)}/v2.0/.well-known/openid-configuration`;
}

/** Liest die Tenant-GUID aus `token_endpoint` bzw. `issuer` der OpenID-Konfiguration */
export function tenantIdFromOpenIdConfig(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;
  for (const key of ['token_endpoint', 'issuer', 'authorization_endpoint']) {
    const v = o[key];
    if (typeof v !== 'string') continue;
    const m = /microsoftonline\.com\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i.exec(v);
    if (m?.[1]) return m[1].toLowerCase();
  }
  return null;
}

export function authorizationCodeBody(p: MsAppConfig & { code: string; redirectUri: string; verifier: string }): URLSearchParams {
  return new URLSearchParams({
    client_id: p.clientId.trim(),
    grant_type: 'authorization_code',
    code: p.code,
    redirect_uri: p.redirectUri,
    code_verifier: p.verifier,
    scope: GRAPH_SCOPES.join(' '),
  });
}

export function refreshTokenBody(p: MsAppConfig & { refreshToken: string }): URLSearchParams {
  return new URLSearchParams({
    client_id: p.clientId.trim(),
    grant_type: 'refresh_token',
    refresh_token: p.refreshToken,
    scope: GRAPH_SCOPES.join(' '),
  });
}

/** Fehler, bei denen nur eine neue Anmeldung hilft */
export function requiresInteraction(err: TokenError): boolean {
  return ['invalid_grant', 'interaction_required', 'login_required', 'consent_required', 'unauthorized_client'].includes(
    err.error,
  );
}

/** Liest E-Mail bzw. UPN aus dem ID-Token, ohne die Signatur zu prüfen (nur Anzeige) */
export function accountFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  const payload = idToken.split('.')[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
    const v = json['preferred_username'] ?? json['email'] ?? json['upn'];
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
}
