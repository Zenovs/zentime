#!/usr/bin/env node
// Bestimmt die nächste Release-Version.
//
// Aufruf: node scripts/next-version.mjs <neuester Tag, z. B. v1.0.3 oder leer>
//
// Regel: Steht in package.json eine höhere Version als der neueste Tag, gilt
// diese (manueller Sprung, z. B. 1.1.0). Sonst wird die Patch-Stelle des
// neuesten Tags um eins erhöht. Ohne Tag gilt die Version aus package.json.

import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const latestTag = (process.argv[2] ?? '').trim();

const parse = (v) => v.replace(/^v/, '').split('.').map((n) => Number.parseInt(n, 10) || 0);
const compare = (a, b) => {
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  }
  return 0;
};

let next = pkg.version;
if (latestTag) {
  const latest = parse(latestTag);
  const current = parse(pkg.version);
  next = compare(current, latest) > 0 ? pkg.version : `${latest[0] ?? 0}.${latest[1] ?? 0}.${(latest[2] ?? 0) + 1}`;
}

if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error(`Ungültige Version: ${next}`);
  process.exit(1);
}
process.stdout.write(next);
