#!/usr/bin/env bash
# zentime auf macOS installieren oder aktualisieren.
#
#   curl -fsSL https://raw.githubusercontent.com/Zenovs/zentime/main/scripts/install-macos.sh | bash
#
# Lädt die neueste Version von GitHub Releases, legt zentime.app in /Applications
# (oder ~/Applications, falls /Applications nicht beschreibbar ist), entfernt die
# Gatekeeper-Quarantäne und startet die App. Ein Ziehen in «Programme» entfällt.
# Danach hält sich die App über den eingebauten Updater selbst aktuell.
set -euo pipefail

REPO="Zenovs/zentime"
ASSET="zentime_universal.app.tar.gz"
URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Dieses Skript ist für macOS. Für Linux siehe README." >&2
  exit 1
fi

DEST="${ZENTIME_DEST:-/Applications}"
if [[ ! -w "$DEST" ]]; then
  DEST="$HOME/Applications"
  mkdir -p "$DEST"
  echo "Hinweis: /Applications ist nicht beschreibbar, installiere nach $DEST"
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Lade zentime (neueste Version) …"
curl -fSL --progress-bar "$URL" -o "$tmp/$ASSET"
tar -xzf "$tmp/$ASSET" -C "$tmp"
if [[ ! -d "$tmp/zentime.app" ]]; then
  echo "Das Archiv enthält keine zentime.app." >&2
  exit 1
fi

# Laufende Instanz beenden, sonst lässt sich das Bundle nicht ersetzen
pkill -x zentime >/dev/null 2>&1 || true
sleep 1

rm -rf "$DEST/zentime.app"
cp -R "$tmp/zentime.app" "$DEST/zentime.app"

# Gatekeeper: Quarantäne-Attribut entfernen und das Bundle ad hoc signieren,
# damit macOS die unsignierte App nicht als «beschädigt» abweist.
xattr -cr "$DEST/zentime.app" 2>/dev/null || true
codesign --force --deep --sign - "$DEST/zentime.app" >/dev/null 2>&1 || true

version="$(defaults read "$DEST/zentime.app/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null || echo "?")"
echo "zentime ${version} installiert: $DEST/zentime.app"
open "$DEST/zentime.app"
echo "Die App läuft in der Menüleiste (Icon «z»)."
