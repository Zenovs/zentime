#!/usr/bin/env node
// Schreibt eine Version in package.json, src-tauri/Cargo.toml und src-tauri/Cargo.lock.
// Aufruf: node scripts/set-version.mjs 1.0.4

import { readFileSync, writeFileSync } from 'node:fs';

const version = (process.argv[2] ?? '').trim();
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Aufruf: node scripts/set-version.mjs <major.minor.patch>');
  process.exit(1);
}

const root = new URL('../', import.meta.url);
const file = (p) => new URL(p, root);

// package.json
const pkgPath = file('package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

// Cargo.toml: nur die Version im [package]-Block
const cargoPath = file('src-tauri/Cargo.toml');
const cargo = readFileSync(cargoPath, 'utf8');
writeFileSync(cargoPath, cargo.replace(/^(\[package\][\s\S]*?^version = ")[^"]+(")/m, `$1${version}$2`));

// Cargo.lock: der Eintrag des eigenen Pakets
const lockPath = file('src-tauri/Cargo.lock');
try {
  const lock = readFileSync(lockPath, 'utf8');
  writeFileSync(lockPath, lock.replace(/(\[\[package\]\]\nname = "zentime"\nversion = ")[^"]+(")/, `$1${version}$2`));
} catch {
  // Kein Lockfile vorhanden: cargo erzeugt es beim Build
}

console.log(`Version ${version} geschrieben`);
