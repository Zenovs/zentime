import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  aadstsCode,
  accountFromIdToken,
  authorizationCodeBody,
  buildAuthorizeUrl,
  codeChallenge,
  openIdConfigUrl,
  codeVerifier,
  parseRedirect,
  refreshTokenBody,
  requiresInteraction,
  tenantIdFromOpenIdConfig,
  tokenUrl,
} from '../src/sources/msauth';
import { domainOf } from '../src/platform/tenant';

describe('PKCE', () => {
  it('S256-Challenge entspricht dem Beispiel aus RFC 7636', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = await codeChallenge(verifier, webcrypto.subtle as SubtleCrypto);
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('Verifier ist base64url ohne Padding und 43 Zeichen lang', () => {
    const v = codeVerifier(new Uint8Array(32).fill(255));
    expect(v).toHaveLength(43);
    expect(v).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('Authorize-URL', () => {
  it('enthält Tenant, Client-ID, Loopback-Redirect und PKCE-Parameter', () => {
    const url = new URL(
      buildAuthorizeUrl({
        tenantId: 'tenant-123',
        clientId: 'client-abc',
        redirectUri: 'http://localhost:54321',
        state: 'st',
        challenge: 'ch',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://login.microsoftonline.com/tenant-123/oauth2/v2.0/authorize');
    expect(url.searchParams.get('client_id')).toBe('client-abc');
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:54321');
    expect(url.searchParams.get('code_challenge')).toBe('ch');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toBe('openid profile offline_access User.Read Calendars.Read');
    expect(url.searchParams.get('state')).toBe('st');
  });

  it('tokenUrl und openIdConfigUrl', () => {
    expect(tokenUrl('common')).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token');
    // Die Discovery liegt unter /v2.0/; unter /oauth2/v2.0/ antwortet Entra mit 404
    expect(openIdConfigUrl('firma.onmicrosoft.com')).toBe(
      'https://login.microsoftonline.com/firma.onmicrosoft.com/v2.0/.well-known/openid-configuration',
    );
    expect(openIdConfigUrl('common')).not.toContain('/oauth2/');
  });
});

describe('parseRedirect', () => {
  it('liefert den Code bei passendem state', () => {
    expect(parseRedirect('http://localhost:1234/?code=abc&state=st&session_state=x', 'st')).toEqual({ ok: true, code: 'abc' });
  });

  it('lehnt falschen state ab', () => {
    const r = parseRedirect('http://localhost:1234/?code=abc&state=other', 'st');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('state_mismatch');
  });

  it('gibt Fehler von Entra weiter', () => {
    const r = parseRedirect('http://localhost:1234/?error=access_denied&error_description=Abgebrochen&state=st', 'st');
    expect(r).toEqual({ ok: false, error: 'access_denied', description: 'Abgebrochen' });
  });
});

describe('Token-Anfragen', () => {
  it('Authorization-Code-Body ohne Client-Secret', () => {
    const b = authorizationCodeBody({ clientId: 'c', tenantId: 't', code: 'code', redirectUri: 'http://localhost:1', verifier: 'v' });
    expect(b.get('grant_type')).toBe('authorization_code');
    expect(b.get('code_verifier')).toBe('v');
    expect(b.has('client_secret')).toBe(false);
  });

  it('Refresh-Body', () => {
    const b = refreshTokenBody({ clientId: 'c', tenantId: 't', refreshToken: 'r' });
    expect(b.get('grant_type')).toBe('refresh_token');
    expect(b.get('refresh_token')).toBe('r');
  });

  it('aadstsCode zieht nur die Nummer aus der Beschreibung', () => {
    expect(
      aadstsCode({
        error: 'invalid_request',
        error_description: "AADSTS9002326: Cross-origin token redemption is permitted only for the 'Single-Page Application' client-type. Trace ID: abc Correlation ID: def",
      }),
    ).toBe('AADSTS9002326');
    expect(aadstsCode({ error: 'invalid_request' })).toBeNull();
  });

  it('requiresInteraction erkennt abgelaufene Anmeldungen', () => {
    expect(requiresInteraction({ error: 'invalid_grant' })).toBe(true);
    expect(requiresInteraction({ error: 'temporarily_unavailable' })).toBe(false);
  });

  it('accountFromIdToken liest preferred_username', () => {
    const payload = Buffer.from(JSON.stringify({ preferred_username: 'zeno@beispiel.ch' })).toString('base64url');
    expect(accountFromIdToken(`h.${payload}.s`)).toBe('zeno@beispiel.ch');
    expect(accountFromIdToken(undefined)).toBeNull();
    expect(accountFromIdToken('kaputt')).toBeNull();
  });
});

describe('Tenant aus E-Mail', () => {
  it('liest die Tenant-GUID aus der OpenID-Konfiguration', () => {
    const json = { token_endpoint: 'https://login.microsoftonline.com/7e3f2917-81a3-483e-969d-e904433ab8af/oauth2/v2.0/token' };
    expect(tenantIdFromOpenIdConfig(json)).toBe('7e3f2917-81a3-483e-969d-e904433ab8af');
    expect(tenantIdFromOpenIdConfig({ error: 'invalid_tenant' })).toBeNull();
    expect(tenantIdFromOpenIdConfig(null)).toBeNull();
  });

  it('domainOf akzeptiert E-Mail oder Domäne', () => {
    expect(domainOf('zeno@Firma.CH')).toBe('firma.ch');
    expect(domainOf('firma.onmicrosoft.com')).toBe('firma.onmicrosoft.com');
    expect(domainOf('kein wert')).toBeNull();
  });
});
