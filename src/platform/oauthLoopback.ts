import { codeChallenge, codeVerifier } from '../sources/msauth';
import { isTauri } from './env';

/**
 * Lokaler Listener für den OAuth-Redirect (Pflichtenheft 5.1). Der Rust-Teil
 * bindet `127.0.0.1` an einen freien Port, nimmt genau einen Request an und
 * liefert dessen URL zurück.
 */
export interface LoopbackServer {
  port: number;
  redirectUri: string;
  /** Wartet auf den Redirect; löst mit der vollständigen URL auf */
  waitForRedirect(timeoutMs: number): Promise<string>;
  cancel(): Promise<void>;
}

export async function startLoopback(): Promise<LoopbackServer> {
  if (!isTauri) {
    throw new Error('Die Microsoft-Anmeldung ist nur in der Desktop-App möglich.');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  const port = await invoke<number>('oauth_start');
  return {
    port,
    redirectUri: `http://localhost:${port}`,
    waitForRedirect: (timeoutMs) => invoke<string>('oauth_wait', { port, timeoutMs }),
    cancel: () => invoke('oauth_cancel', { port }),
  };
}

export interface PkcePair {
  verifier: string;
  challenge: string;
  state: string;
}

/** PKCE-Werte: in der Desktop-App aus Rust, im Browser über WebCrypto */
export async function pkcePair(): Promise<PkcePair> {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<PkcePair>('oauth_pkce');
  }
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const verifier = codeVerifier(random);
  const challenge = await codeChallenge(verifier, crypto.subtle);
  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  return { verifier, challenge, state: Array.from(stateBytes, (b) => b.toString(16).padStart(2, '0')).join('') };
}
