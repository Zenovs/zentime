import type { Store } from '@tauri-apps/plugin-store';
import { isTauri } from './env';

/** Einfache JSON-Ablage im App-Config-Verzeichnis (tauri-plugin-store) */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

class TauriStore implements KeyValueStore {
  private store: Promise<Store> | null = null;
  constructor(private readonly file: string) {}

  private open() {
    if (!this.store) {
      this.store = import('@tauri-apps/plugin-store').then((m) => m.load(this.file, { autoSave: 250, defaults: {} }));
    }
    return this.store;
  }
  async get<T>(key: string): Promise<T | undefined> {
    const s = await this.open();
    return (await s.get<T>(key)) ?? undefined;
  }
  async set<T>(key: string, value: T): Promise<void> {
    const s = await this.open();
    await s.set(key, value);
    await s.save();
  }
  async delete(key: string): Promise<void> {
    const s = await this.open();
    await s.delete(key);
    await s.save();
  }
}

class BrowserStore implements KeyValueStore {
  constructor(private readonly file: string) {}
  private k(key: string) {
    return `zentime.${this.file}.${key}`;
  }
  async get<T>(key: string): Promise<T | undefined> {
    const raw = localStorage.getItem(this.k(key));
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }
  async set<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(this.k(key), JSON.stringify(value));
  }
  async delete(key: string): Promise<void> {
    localStorage.removeItem(this.k(key));
  }
}

export function openStore(file: string): KeyValueStore {
  return isTauri ? new TauriStore(file) : new BrowserStore(file);
}

export const settingsStore = openStore('settings.json');
export const cacheStore = openStore('cache.json');
