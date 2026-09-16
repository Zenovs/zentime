import { useMemo } from 'react';
import { dayWindow, type DayOffset } from '../logic/day';
import { nextGap, type Gap } from '../logic/gaps';
import { computeDayHero, computeHero, type Hero } from '../logic/hero';
import { eventsForDay, focusEvent, remainingCount, type DayEvents } from '../logic/timeline';
import type { CalendarEvent } from '../model/event';
import { overlaps } from '../model/event';
import { systemZone } from '../platform/env';
import { selectAllEvents, useAppStore } from './store';

export interface DayModel {
  now: number;
  zone: string;
  /** Gewählter Tag im Tag-Rad, 0 = heute */
  dayOffset: DayOffset;
  isToday: boolean;
  /** Sind für diesen Tag überhaupt schon Termine abgerufen worden? */
  dayLoaded: boolean;
  /** Termine des gewählten Tages */
  day: DayEvents;
  /** Termine des Folgetags; speist den Ausblick im Hero (F-12) */
  next: DayEvents;
  hero: Hero;
  /** Termin im Detailraster */
  selected: CalendarEvent | null;
  /** Termin, zu dem die Tagesleiste scrollt */
  focus: CalendarEvent | null;
  /** Offene Termine (heute: ab jetzt, sonst alle des Tages) */
  remaining: number;
  gap: Gap | null;
  hasAny: boolean;
}

/** Leitet alles ab, was die Tagesansicht zeigt; reine Funktionen aus `logic/` */
export function useDayModel(): DayModel {
  const now = useAppStore((s) => s.now);
  const settings = useAppStore((s) => s.settings);
  const runtime = useAppStore((s) => s.runtime);
  const selectedId = useAppStore((s) => s.selectedEventId);
  const dayOffset = useAppStore((s) => s.dayOffset);
  const dayRange = useAppStore((s) => s.dayRange);
  const zone = systemZone;

  return useMemo(() => {
    const all = selectAllEvents({ runtime, settings });
    const dayW = dayWindow(now, zone, dayOffset);
    const nextW = dayWindow(now, zone, dayOffset + 1);
    const opts = { hideDeclined: settings.hideDeclined };
    const day = eventsForDay(all, dayW, opts);
    const next = eventsForDay(all, nextW, opts);
    const isToday = dayOffset === 0;
    const dayLoaded = dayOffset >= dayRange.from && dayOffset <= dayRange.to;

    // Nur heute kennt «läuft» und «noch»; andere Tage zeigen einen Überblick.
    const hero = isToday
      ? computeHero({ timed: day.timed, allDay: day.allDay, tomorrowTimed: next.timed, now, zone })
      : computeDayHero({ timed: day.timed, allDay: day.allDay, zone, loaded: dayLoaded });
    const focus = isToday ? focusEvent(day.timed, now) : (day.timed[0] ?? null);

    const pool = [...day.timed, ...day.allDay, ...next.timed];
    const byId = (id: string | null) => (id ? (pool.find((e) => e.id === id) ?? null) : null);
    const selected = byId(selectedId) ?? byId(hero.eventId) ?? focus;

    const hasAny = day.timed.length > 0;
    const from = isToday ? now : dayW.start;
    const gapFrom = selected && !selected.allDay && overlaps(selected, dayW) ? Math.max(selected.end, from) : from;
    const gap = hasAny ? nextGap(day.timed, gapFrom, dayW) : null;

    return {
      now,
      zone,
      dayOffset,
      isToday,
      dayLoaded,
      day,
      next,
      hero,
      selected,
      focus,
      remaining: isToday ? remainingCount(day.timed, now) : day.timed.length,
      gap,
      hasAny,
    };
  }, [now, settings, runtime, selectedId, dayOffset, dayRange, zone]);
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
