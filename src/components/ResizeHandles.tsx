import type { CSSProperties } from 'react';
import { isTauri } from '../platform/env';
import { startResize, type ResizeEdge } from '../platform/windowDrag';

const EDGE = 6;
const CORNER = 14;

const handles: Array<{ edge: ResizeEdge; style: CSSProperties; cursor: string }> = [
  { edge: 'North', style: { top: 0, left: CORNER, right: CORNER, height: EDGE }, cursor: 'ns-resize' },
  { edge: 'South', style: { bottom: 0, left: CORNER, right: CORNER, height: EDGE }, cursor: 'ns-resize' },
  { edge: 'West', style: { left: 0, top: CORNER, bottom: CORNER, width: EDGE }, cursor: 'ew-resize' },
  { edge: 'East', style: { right: 0, top: CORNER, bottom: CORNER, width: EDGE }, cursor: 'ew-resize' },
  { edge: 'NorthWest', style: { top: 0, left: 0, width: CORNER, height: CORNER }, cursor: 'nwse-resize' },
  { edge: 'NorthEast', style: { top: 0, right: 0, width: CORNER, height: CORNER }, cursor: 'nesw-resize' },
  { edge: 'SouthWest', style: { bottom: 0, left: 0, width: CORNER, height: CORNER }, cursor: 'nesw-resize' },
  { edge: 'SouthEast', style: { bottom: 0, right: 0, width: CORNER, height: CORNER }, cursor: 'nwse-resize' },
];

/** Unsichtbare Griffe an Rändern und Ecken des rahmenlosen Fensters */
export function ResizeHandles() {
  if (!isTauri) return null;
  return (
    <>
      {handles.map((h) => (
        <div
          key={h.edge}
          data-resize={h.edge}
          aria-hidden
          style={{ position: 'absolute', zIndex: 50, cursor: h.cursor, ...h.style }}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            void startResize(h.edge);
          }}
        />
      ))}
    </>
  );
}
