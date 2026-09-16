import { useEffect, useState } from 'react';

/** Unter dieser Fensterhöhe zeigt das Widget nur Kopfzeile und Hero (Kompaktmodus, F-20) */
export const COMPACT_HEIGHT = 360;

export function useWindowSize(): { width: number; height: number; compact: boolean } {
  const read = () => ({ width: window.innerWidth, height: window.innerHeight });
  const [size, setSize] = useState(read);
  useEffect(() => {
    const onResize = () => setSize(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return { ...size, compact: size.height < COMPACT_HEIGHT };
}
