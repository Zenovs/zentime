import type { GraphSourceConfig } from '../model/settings';
import { secretKeys } from '../model/settings';
import {
  accountFromIdToken,
  authorizationCodeBody,
  buildAuthorizeUrl,
  parseRedirect,
  refreshTokenBody,
  requiresInteraction,
  tokenUrl,
  type TokenError,
  type TokenResponse,
} from '../sources/msauth';
import { HttpError, httpFetch, retryAfterMs, type HttpFetch } from './http';
import { describeError, log } from './log';
import { pkcePair, startLoopback } from './oauthLoopback';
import { secrets, type SecretStore } from './secrets';
import { openExternal } from './shell';

export class AuthRequiredError extends Error {
  constructor(message = 'Neu anmelden') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

const LOGIN_TIMEOUT_MS = 5 * 60_000;
/** Access-Token gilt als abgelaufen, wenn weniger als so viel Zeit bleibt */
const EXPIRY_MARGIN_MS = 60_000;

interface Deps {
  http: HttpFetch;
  secrets: SecretStore;
  now: () => number;
}

/**
 * Verwaltet Login, Access- und Refresh-Token einer Microsoft-365-Quelle.
 * Der Refresh-Token liegt im Schlüsselbund, der Access-Token nur im Speicher.
 */
export class GraphSession {
  private accessToken: string | null = null;
  private expiresAt = 0;
  private refreshing: Promise<string> | null = null;
  /** Nach `logout()` darf kein Token mehr gespeichert werden, auch nicht aus laufenden Anfragen */
  private revoked = false;

  constructor(
    private cfg: Pick<GraphSourceConfig, 'id' | 'clientId' | 'tenantId'>,
    private readonly deps: Deps = { http: httpFetch, secrets, now: Date.now },
  ) {}

  updateConfig(cfg: Pick<GraphSourceConfig, 'id' | 'clientId' | 'tenantId'>) {
    this.cfg = cfg;
  }

  /** Interaktive Anmeldung im Systembrowser (Pflichtenheft 5.1, Login-Schritte 1–4) */
  async login(loginHint?: string): Promise<{ account: string | null }> {
    log.info(`graph ${this.cfg.id}: Anmeldung gestartet`);
    const server = await startLoopback();
    try {
      this.revoked = false;
      const { verifier, challenge, state } = await pkcePair();
      const url = buildAuthorizeUrl({
        clientId: this.cfg.clientId,
        tenantId: this.cfg.tenantId,
        redirectUri: server.redirectUri,
        state,
        challenge,
        ...(loginHint ? { loginHint } : {}),
      });
      await openExternal(url);
      log.info(`graph ${this.cfg.id}: Browser geöffnet, warte auf Redirect (Port ${server.port})`);

      const redirect = await server.waitForRedirect(LOGIN_TIMEOUT_MS);
      log.info(`graph ${this.cfg.id}: Redirect erhalten`);
      const parsed = parseRedirect(redirect, state);
      if (!parsed.ok) throw new Error(loginErrorText(parsed.error));

      const token = await this.requestToken(
        authorizationCodeBody({
          clientId: this.cfg.clientId,
          tenantId: this.cfg.tenantId,
          code: parsed.code,
          redirectUri: server.redirectUri,
          verifier,
        }),
      );
      if (!token.refresh_token) throw new Error('Kein Refresh-Token erhalten (fehlt `offline_access`?)');
      log.info(`graph ${this.cfg.id}: Anmeldung erfolgreich`);
      return { account: accountFromIdToken(token.id_token) };
    } catch (e) {
      log.warn(`graph ${this.cfg.id}: Anmeldung fehlgeschlagen: ${describeError(e)}`);
      throw e;
    } finally {
      await server.cancel().catch(() => undefined);
    }
  }

  async logout(): Promise<void> {
    this.revoked = true;
    this.accessToken = null;
    this.expiresAt = 0;
    await this.deps.secrets.delete(secretKeys.graphRefreshToken(this.cfg.id)).catch(() => undefined);
  }

  async hasRefreshToken(): Promise<boolean> {
    return (await this.deps.secrets.get(secretKeys.graphRefreshToken(this.cfg.id))) !== null;
  }

  private async requestToken(body: URLSearchParams): Promise<TokenResponse> {
    const res = await this.deps.http(tokenUrl(this.cfg.tenantId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json = (await res.json().catch(() => ({}))) as TokenResponse | TokenError;
    if (!res.ok || !('access_token' in json)) {
      const err = json as TokenError;
      if (requiresInteraction(err)) {
        await this.deps.secrets.delete(secretKeys.graphRefreshToken(this.cfg.id)).catch(() => undefined);
        throw new AuthRequiredError();
      }
      // Nur der Fehlercode, nie `error_description`: die enthält oft Kontoname und Korrelations-IDs
      throw new HttpError(res.status, `Anmeldedienst: ${err.error ?? `HTTP ${res.status}`}`);
    }
    if (this.revoked) {
      throw new AuthRequiredError('Quelle wurde entfernt');
    }
    if (json.refresh_token) {
      await this.deps.secrets.set(secretKeys.graphRefreshToken(this.cfg.id), json.refresh_token);
    }
    this.accessToken = json.access_token;
    this.expiresAt = this.deps.now() + json.expires_in * 1000;
    return json;
  }

  /** Liefert ein gültiges Access-Token, erneuert es bei Bedarf still */
  async getAccessToken(force = false): Promise<string> {
    if (!force && this.accessToken && this.deps.now() < this.expiresAt - EXPIRY_MARGIN_MS) {
      return this.accessToken;
    }
    if (!this.refreshing) {
      this.refreshing = this.refresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async refresh(): Promise<string> {
    if (this.revoked) throw new AuthRequiredError();
    const refreshToken = await this.deps.secrets.get(secretKeys.graphRefreshToken(this.cfg.id));
    if (!refreshToken) throw new AuthRequiredError();
    const token = await this.requestToken(
      refreshTokenBody({ clientId: this.cfg.clientId, tenantId: this.cfg.tenantId, refreshToken }),
    );
    return token.access_token;
  }

  /**
   * GET mit Bearer-Token. 401 → Token einmal erneuern und wiederholen;
   * 429 → `Retry-After` als `HttpError.retryAfterMs` weiterreichen.
   */
  async fetchJson<T>(url: string): Promise<T> {
    let token = await this.getAccessToken();
    let res = await this.deps.http(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (res.status === 401) {
      token = await this.getAccessToken(true);
      res = await this.deps.http(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    }
    if (res.status === 401 || res.status === 403) {
      log.warn(`graph ${this.cfg.id}: HTTP ${res.status}`);
      throw new AuthRequiredError(res.status === 403 ? 'Keine Berechtigung (Calendars.Read?)' : 'Neu anmelden');
    }
    if (res.status === 429) {
      throw new HttpError(429, 'Zu viele Anfragen', retryAfterMs(res, this.deps.now()) ?? 60_000);
    }
    if (!res.ok) {
      throw new HttpError(res.status, `Graph antwortete mit ${res.status}`);
    }
    try {
      return (await res.json()) as T;
    } catch (e) {
      throw new Error(`Antwort nicht lesbar: ${describeError(e)}`, { cause: e });
    }
  }
}

/** Kurze, datenfreie Meldung für Fehler aus dem Redirect */
function loginErrorText(code: string): string {
  switch (code) {
    case 'access_denied':
      return 'Anmeldung abgebrochen';
    case 'state_mismatch':
      return 'Antwort gehört nicht zu dieser Anmeldung';
    case 'invalid_redirect':
    case 'missing_code':
      return 'Ungültige Antwort vom Anmeldedienst';
    default:
      return `Anmeldung fehlgeschlagen (${code})`;
  }
}
