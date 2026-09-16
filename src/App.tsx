import { useEffect, useRef } from 'react';
import { demoEvents, demoNow, demoSettings, readDemoParams } from './app/demo';
import { engine } from './app/engine';
import { loadSettings, persistSettings } from './app/persistence';
import { useAppStore } from './app/store';
import { useResolvedTheme } from './app/theme';
import { useWindowSize } from './app/useWindowSize';
import { AddSourceView } from './components/AddSourceView';
import { ResizeHandles } from './components/ResizeHandles';
import { SettingsView } from './components/SettingsView';
import { SourceView } from './components/SourceView';
import { TodayView } from './components/TodayView';
import { msUntilNextMinute } from './logic/day';
import { onTrayCommand, setAlwaysOnTop, showWindowWhenReady } from './platform/desktop';
import { isTauri, systemZone } from './platform/env';
import { UPDATE_CHECK_INTERVAL_MS } from './platform/updater';
import { installWindowDrag } from './platform/windowDrag';
import { runUpdateCheck } from './app/update';

const demo = readDemoParams(typeof location === 'undefined' ? '' : location.search);

/** Bootstrap: Einstellungen, Cache, Sync, Timer, Tastenkürzel, Tray */
function useBootstrap() {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const store = useAppStore.getState();

    if (demo.enabled) {
      const fixedNow = demoNow(demo.now, systemZone);
      const now = fixedNow ?? Date.now();
      store.setSettingsLoaded(demoSettings(demo.theme));
      store.setNow(now);
      if (demo.view === 'source') store.setView({ name: 'source', id: 'demo-ms' });
      else if (demo.view !== 'today') store.setView({ name: demo.view });
      for (const [id, events] of Object.entries(demoEvents(now, systemZone, demo.scenario))) {
        store.patchRuntime(id, { status: 'ok', events, syncedAt: now - 4 * 60_000, nextDueAt: Infinity });
      }
      return;
    }

    let unsubscribe: (() => void) | null = null;
    void (async () => {
      const settings = await loadSettings();
      store.setSettingsLoaded(settings);
      unsubscribe = persistSettings();
      void setAlwaysOnTop(settings.alwaysOnTop);
      await engine.start();
      if (settings.autoUpdate) void runUpdateCheck();
    })();

    // Auto-Update (F-23): beim Start und danach täglich, solange die App läuft
    const updateTimer = setInterval(() => {
      if (useAppStore.getState().settings.autoUpdate) void runUpdateCheck();
    }, UPDATE_CHECK_INTERVAL_MS);

    return () => {
      unsubscribe?.();
      clearInterval(updateTimer);
      engine.stop();
    };
  }, []);
}

/** «Jetzt» minütlich, auf die volle Minute ausgerichtet (7.2) */
function useMinuteClock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      const now = Date.now();
      useAppStore.getState().setNow(now);
      timer = setTimeout(arm, msUntilNextMinute(now) + 20);
    };
    arm();
    return () => clearTimeout(timer);
  }, [enabled]);
}

function useShortcutsAndTray() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const s = useAppStore.getState();
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        void engine.refreshAll(true);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        s.togglePrivateMode();
      } else if (mod && e.key === ',') {
        e.preventDefault();
        s.setView({ name: 'settings' });
      } else if (e.key === 'Escape') {
        s.setView({ name: 'today' });
        s.selectEvent(null);
      }
    };
    window.addEventListener('keydown', onKey);
    const uninstallDrag = installWindowDrag();

    let unlisten: (() => void) | null = null;
    let cancelled = false;
    void onTrayCommand((cmd) => {
      const s = useAppStore.getState();
      if (cmd === 'refresh') void engine.refreshAll(true);
      else if (cmd === 'settings') s.setView({ name: 'settings' });
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      uninstallDrag();
      unlisten?.();
    };
  }, []);
}

export function App() {
  useBootstrap();
  useMinuteClock(!demo.now);
  useShortcutsAndTray();

  const mode = useAppStore((s) => s.settings.theme);
  const opacity = useAppStore((s) => s.settings.opacity);
  const loaded = useAppStore((s) => s.settingsLoaded);
  const view = useAppStore((s) => s.view);
  const theme = useResolvedTheme(mode);
  const { compact } = useWindowSize();
  const viewOpacity = view.name === 'today' ? opacity : 1;

  useEffect(() => {
    if (loaded && isTauri) void showWindowWhenReady();
  }, [loaded]);

  return (
    <div
      className="relative flex h-full w-full flex-col rounded-3xl text-fg"
      data-theme={theme}
      style={demo.frame ? { width: 340, height: 620 } : undefined}
    >
      {/*
        Die Deckkraft liegt auf einer eigenen, deckend gezeichneten Ebene und
        wird erst beim Zusammensetzen angewandt (Deckkraft nur in der
        Tagesansicht; Einstellungen und Dialoge bleiben deckend).

        Würde stattdessen der Wurzelknoten halbtransparent gefüllt, mischte
        WebKitGTK bei transparenten Fenstern jeden neuen Frame über den alten,
        statt die Fläche vorher zu löschen: häufig neu gezeichnete Bereiche
        wie der Hero wurden dann Schicht um Schicht dunkler, und eine einmal
        geöffnete Ansicht blieb als Geisterbild stehen.
      */}
      <div
        className="pointer-events-none absolute inset-0 rounded-3xl bg-bg"
        style={{ opacity: viewOpacity, willChange: 'opacity' }}
        aria-hidden
      />
      <ResizeHandles />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto p-6 no-scrollbar">
        {!loaded ? null : view.name === 'today' ? (
          <TodayView theme={theme} compact={compact} />
        ) : view.name === 'settings' ? (
          <SettingsView />
        ) : view.name === 'add-source' ? (
          <AddSourceView initialKind={view.kind} />
        ) : (
          <SourceView id={view.id} />
        )}
      </div>
    </div>
  );
}
