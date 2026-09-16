import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const script = new URL('../scripts/next-version.mjs', import.meta.url).pathname;
const pkgVersion = (JSON.parse(execFileSync('node', ['-p', 'JSON.stringify(require("./package.json"))'], { encoding: 'utf8' })) as { version: string })
  .version;
const run = (latestTag: string) => execFileSync('node', [script, latestTag], { encoding: 'utf8' }).trim();

describe('Release-Version', () => {
  it('ohne Tag gilt die Version aus package.json', () => {
    expect(run('')).toBe(pkgVersion);
  });

  it('erhöht sonst die Patch-Stelle des neuesten Tags', () => {
    expect(run('v9.3.7')).toBe('9.3.8');
    expect(run('v9.3')).toBe('9.3.1');
  });

  it('übernimmt einen manuellen Sprung in package.json, wenn er höher ist', () => {
    expect(run('v0.9.0')).toBe(pkgVersion);
  });
});
