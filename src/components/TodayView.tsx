import { useCallback } from 'react';
import { engine } from '../app/engine';
import { useDayModel, useSyncSummary } from '../app/derived';
import { updateStatusText } from '../platform/updater';
import { sourceIndex, useAppStore } from '../app/store';
import { toggledTheme, type ResolvedTheme } from '../app/theme';
import { dayTitle, dayWindow } from '../logic/day';
import type { CalendarEvent } from '../model/event';
import { overlaps } from '../model/event';
import { sourceColor } from '../model/settings';
import { AllDayRow } from './AllDayRow';
import { DayWheel } from './DayWheel';
import { DetailGrid } from './DetailGrid';
import { Header } from './Header';
import { Hero } from './Hero';
import { Timeline } from './Timeline';

interface TodayViewProps {
  theme: ResolvedTheme;
  /** Nur Kopfzeile und Hero (kleines Fenster, F-20) */
  compact: boolean;
}

export function TodayView({ theme, compact }: TodayViewProps) {
  const model = useDayModel();
  const sync = useSyncSummary();
  const settings = useAppStore((s) => s.settings);
  const privateMode = useAppStore((s) => s.privateMode);
  const setView = useAppStore((s) => s.setView);
  const patchSettings = useAppStore((s) => s.patchSettings);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const togglePrivateMode = useAppStore((s) => s.togglePrivateMode);
  const updateStatus = useAppStore((s) => s.updateStatus);


  const colorFor = useCallback((ev: CalendarEvent) => sourceColor(sourceIndex(settings, ev.sourceId)), [settings]);

  const noSources = settings.sources.length === 0;
  const selected = model.selected;
  const shownDay = dayWindow(model.now, model.zone, model.dayOffset);
  const isTomorrow = !!selected && !overlaps(selected, shownDay);

  return (
    <>
      <Header
        title={dayTitle(model.dayOffset, model.now, model.zone)}
        dateMs={shownDay.start}
        zone={model.zone}
        theme={theme}
        stale={sync.stale}
        latestSync={sync.latestSync}
        hasError={sync.hasError}
        privateMode={privateMode}
        updateHint={updateStatusText(updateStatus)}
        onToggleTheme={() => patchSettings({ theme: toggledTheme(theme) })}
        onOpenSettings={() => setView({ name: 'settings' })}
        onTogglePrivate={togglePrivateMode}
      />

      <Hero hero={model.hero} privateMode={privateMode} />

      {compact ? null : (
        <>
      <DayWheel now={model.now} zone={model.zone} offset={model.dayOffset} onChange={(offset) => engine.showDay(offset)} />

      {noSources ? (
        <button
          type="button"
          onClick={() => setView({ name: 'add-source' })}
          className="mt-6 rounded-xl border border-line px-4 py-3 text-left text-[13px] leading-[18px] text-muted hover:text-fg"
        >
          Noch keine Kalenderquelle eingerichtet. Hier Microsoft 365 oder einen ICS-Kalender hinzufügen.
        </button>
      ) : null}

      <AllDayRow
        events={model.day.allDay}
        colorFor={colorFor}
        privateMode={privateMode}
        selectedId={selected?.id ?? null}
        onSelect={selectEvent}
      />

      <Timeline
        events={model.day.timed}
        now={model.now}
        zone={model.zone}
        colorFor={colorFor}
        selectedId={selected?.id ?? null}
        focusId={model.focus?.id ?? null}
        hasAllDayRow={model.day.allDay.length > 0}
        privateMode={privateMode}
        onSelect={selectEvent}
      />

      <DetailGrid
        event={selected}
        zone={model.zone}
        remaining={model.remaining}
        gap={isTomorrow ? null : model.gap}
        color={selected ? colorFor(selected) : null}
        privateMode={privateMode}
        isTomorrow={isTomorrow}
        isToday={model.isToday}
      />
        </>
      )}
    </>
  );
}
