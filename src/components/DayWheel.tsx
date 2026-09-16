import { useCallback, useEffect, useRef, useState } from 'react';
import { dayLabel, dayTitle, type DayOffset } from '../logic/day';
import { detented, settleOffset } from '../logic/wheel';
import { cx } from './ui';

interface DayWheelProps {
  now: number;
  zone: string;
  offset: DayOffset;
  onChange: (offset: DayOffset) => void;
}

/** Breite einer Radposition; der Rest der Fläche deutet die Nachbartage an */
const CELL_FRACTION = 0.42;
/** So viele Tage werden links und rechts der Mitte gezeichnet */
const SPAN = 2;
/** Bis hierhin gilt ein Zeigerdruck als Klick, nicht als Ziehen */
const CLICK_SLOP = 4;

/**
 * Tag-Rad zwischen Hero und Terminliste (F-12). Es dreht in beide Richtungen
 * unbegrenzt; die Nachbartage sind angedeutet und laufen zum Rand hin aus.
 * Ziehen verhält sich wie ein mechanisches Rad: Es rastet an jedem Tag ein und
 * fällt beim Loslassen je nach Schwung eine oder mehrere Rasten weiter.
 */
export function DayWheel({ now, zone, offset, onChange }: DayWheelProps) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const gesture = useRef<{ id: number; startX: number; lastX: number; lastT: number; velocity: number; moved: number } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const cell = Math.max(1, width * CELL_FRACTION);

  const settle = useCallback(
    (px: number, velocity: number) => {
      const next = settleOffset(px, velocity, cell, offset);
      setDragging(false);
      setDrag(0);
      if (next !== offset) onChange(next);
    },
    [cell, offset, onChange],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    gesture.current = { id: e.pointerId, startX: e.clientX, lastX: e.clientX, lastT: e.timeStamp, velocity: 0, moved: 0 };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    const dt = Math.max(1, e.timeStamp - g.lastT);
    g.velocity = (e.clientX - g.lastX) / dt;
    g.lastX = e.clientX;
    g.lastT = e.timeStamp;
    g.moved = Math.max(g.moved, Math.abs(e.clientX - g.startX));
    setDrag(detented(e.clientX - g.startX, cell));
  };

  const endGesture = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g || g.id !== e.pointerId) return;
    gesture.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    settle(e.clientX - g.startX, g.velocity);
  };

  // Ein Tag mehr als sichtbar, damit beim Weiterdrehen nie eine Lücke entsteht
  const days: number[] = [];
  for (let d = offset - SPAN; d <= offset + SPAN; d += 1) days.push(d);

  return (
    <div
      ref={box}
      data-no-drag
      role="group"
      aria-label="Tag wählen"
      tabIndex={0}
      className="wheel-fade relative mt-6 h-12 touch-pan-y overflow-hidden select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endGesture}
      onPointerCancel={endGesture}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(offset - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); onChange(offset + 1); }
        if (e.key === 'Home') { e.preventDefault(); onChange(0); }
      }}
    >
      {/* Raste: die Mulde, in die das Rad einrastet */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 h-0.5 -translate-x-1/2 rounded-full bg-fg/15"
        style={{ width: cell * 0.62 }}
      />
      {days.map((value) => {
        const { weekday, day } = dayLabel(now, zone, value);
        const away = value - offset + drag / cell;
        const distance = Math.min(1, Math.abs(away));
        const active = value === offset;
        return (
          <button
            key={value}
            type="button"
            aria-label={`${dayTitle(value, now, zone)}, ${weekday} ${day}.`}
            aria-current={active ? 'date' : undefined}
            tabIndex={-1}
            onClick={() => {
              if ((gesture.current?.moved ?? 0) > CLICK_SLOP) return;
              if (value !== offset) onChange(value);
            }}
            className="absolute inset-y-0 flex flex-col items-center justify-center gap-0.5"
            style={{
              width: cell,
              left: width / 2 - cell / 2,
              transform: `translate3d(${away * cell}px, 0, 0) scale(${1 - distance * 0.12})`,
              opacity: 1 - distance * 0.6,
              transition: dragging ? 'none' : 'transform var(--wheel-settle), opacity var(--wheel-settle)',
            }}
          >
            <span className="text-[13px] leading-4 text-muted">{weekday}</span>
            <span className={cx('tnum text-[17px] leading-6', active ? 'font-semibold text-fg' : 'font-medium text-fg/70')}>{day}</span>
          </button>
        );
      })}
    </div>
  );
}
