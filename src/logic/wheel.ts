/**
 * Mechanik des Tag-Rads (F-12). Reine Funktionen, damit sich das Fahrgefühl
 * prüfen lässt statt nach Augenmass zu entstehen. Das Rad hat keine Enden;
 * es dreht in beide Richtungen unbegrenzt weiter.
 */

/** Rastkurve: > 1 macht die Mitte zäh, zum Rand hin löst sich das Rad */
export const DETENT = 1.7;
/** So weit wird der Schwung beim Loslassen vorausgerechnet */
export const FLICK_MS = 90;

/**
 * Verzerrt den Ziehweg so, dass jede Position spürbar festhält: Nahe einer
 * Raste bewegt sich das Rad weniger als der Finger, dazwischen holt es auf.
 */
export function detented(px: number, cell: number): number {
  if (!(cell > 0)) return px;
  const step = Math.round(px / cell);
  const rest = px - step * cell;
  const t = Math.max(-1, Math.min(1, rest / (cell / 2)));
  return step * cell + Math.sign(t) * Math.abs(t) ** DETENT * (cell / 2);
}

/**
 * Tag, auf dem das Rad beim Loslassen einrastet. Der Schwung zählt mit: ein
 * kurzer Stups genügt für den Nachbartag, ein kräftiger Wisch trägt weiter.
 */
export function settleOffset(px: number, velocityPxPerMs: number, cell: number, offset: number): number {
  if (!(cell > 0)) return offset;
  return offset - Math.round((px + velocityPxPerMs * FLICK_MS) / cell);
}
