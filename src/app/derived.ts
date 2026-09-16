import { useMemo } from 'react';
import { dayWindow } from '../logic/day';
import { nextGap, type Gap } from '../logic/gaps';
import { computeHero, type Hero } from '../logic/hero';
import { eventsForDay, focusEvent, remainingCount, type DayEvents } from '../logic/timeline';
import type { CalendarEvent } from '../model/event';
import { overlaps } from '../model/event';
import { systemZone } from '../platform/env';
import { selectAllEvents, useAppStore } from './store';

export interface DayModel {
  now: number;
  zone: string;
  today: DayEvents;
  tomorrow: DayEvents;
  hero: Hero;
  /** Termin im Detailraster */
  selected: CalendarEvent | null;
  /** Termin, zu dem die Tagesleiste scrollt */
  focus: CalendarEvent | null;
  remaining: number;
  gap: Gap | null;
  hasAnyToday: boolean;
}

/** Leitet alles ab, was die Tagesansicht zeigt; reine Funktionen aus `logic/` */
export function useDayModel(): DayModel {
  const now = useAppStore((s) => s.now);
  const settings = useAppStore((s) => s.settings);
  const runtime = useAppStore((s) => s.runtime);
  const selectedId = useAppStore((s) => s.selectedEventId);
  const zone = systemZone;

  return useMemo(() => {
    const all = selectAllEvents({ runtime, settings });
    const todayWindow = dayWindow(now, zone);
    const tomorrowWindow = dayWindow(now, zone, 1);
    const opts = { hideDeclined: settings.hideDeclined };
    const today = eventsForDay(all, todayWindow, opts);
    const tomorrow = eventsForDay(all, tomorrowWindow, opts);
    const hero = computeHero({ timed: today.timed, allDay: today.allDay, tomorrowTimed: tomorrow.timed, now, zone });
    const focus = focusEvent(today.timed, now);

    const pool = [...today.timed, ...today.allDay, ...tomorrow.timed];
    const byId = (id: string | null) => (id ? (pool.find((e) => e.id === id) ?? null) : null);
    const selected = byId(selectedId) ?? byId(hero.eventId) ?? focus;

    const hasAnyToday = today.timed.length > 0;
    const gapFrom = selected && !selected.allDay && overlaps(selected, todayWindow) ? Math.max(selected.end, now) : now;
    const gap = hasAnyToday ? nextGap(today.timed, gapFrom, todayWindow) : null;

    return {
      now,
      zone,
      today,
      tomorrow,
      hero,
      selected,
      focus,
      remaining: remainingCount(today.timed, now),
      gap,
      hasAnyToday,
    };
  }, [now, settings, runtime, selectedId, zone]);
}

/** Zusammengefasster Zustand der Quellen für die Kopfzeile */
export function useSyncSummary() {
  const settings = useAppStore((s) => s.settings);
  const runtime = useAppStore((s) => s.runtime);
  const online = useAppStore((s) => s.online);
  return useMemo(() => {
    let latest: number | null = null;
    let hasError = false;
    let loading = false;
    for (const src of settings.sources) {
      const rt = runtime[src.id];
      if (!rt) continue;
      if (rt.syncedAt && (!latest || rt.syncedAt > latest)) latest = rt.syncedAt;
      if (rt.status === 'error' || rt.status === 'auth') hasError = true;
      if (rt.status === 'loading') loading = true;
    }
    return { latestSync: latest, hasError, loading, stale: hasError || !online, online };
  }, [settings, runtime, online]);
}
