import { isTauri } from './env';

/** Passwörter, Tokens und ICS-URLs: nur im Schlüsselbund (Pflichtenheft 8) */
export interface SecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

class KeyringSecrets implements SecretStore {
  async get(key: string): Promise<string | null> {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string | null>('secret_get', { key });
  }
  async set(key: string, value: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('secret_set', { key, value });
  }
  async delete(key: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('secret_delete', { key });
  }
}

/** Nur für `pnpm dev` im Browser: unverschlüsselt im localStorage, nie im Tauri-Build aktiv */
class BrowserSecrets implements SecretStore {
  private k(key: string) {
    return `zentime.secret.${key}`;
  }
  async get(key: string) {
    return localStorage.getItem(this.k(key));
  }
  async set(key: string, value: string) {
    localStorage.setItem(this.k(key), value);
  }
  async delete(key: string) {
    localStorage.removeItem(this.k(key));
  }
}

export const secrets: SecretStore = isTauri ? new KeyringSecrets() : new BrowserSecrets();
