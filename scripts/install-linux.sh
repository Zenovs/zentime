#!/usr/bin/env bash
# zentime auf Linux (x86_64) installieren oder aktualisieren.
#
#   curl -fsSL https://raw.githubusercontent.com/Zenovs/zentime/main/scripts/install-linux.sh | bash
#
# Lädt das AppImage der neuesten Version nach ~/Applications, legt einen
# Menüeintrag an und startet die App. Das AppImage aktualisiert sich danach
# selbst über den eingebauten Updater. Getestet für Ubuntu 24.04 (GNOME).
set -euo pipefail

REPO="Zenovs/zentime"
API="https://api.github.com/repos/${REPO}/releases/latest"
DEST_DIR="${ZENTIME_DEST:-$HOME/Applications}"
DEST="$DEST_DIR/zentime.AppImage"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "Dieses Skript ist für Linux. Für macOS siehe README." >&2
  exit 1
fi
if [[ "$(uname -m)" != "x86_64" ]]; then
  echo "Es gibt zurzeit nur ein Paket für x86_64 (gefunden: $(uname -m))." >&2
  exit 1
fi

# AppImages brauchen FUSE 2. Ubuntu 24.04 installiert es nicht mehr von Haus aus.
if ! ldconfig -p 2>/dev/null | grep -q 'libfuse.so.2'; then
  if command -v apt-get >/dev/null 2>&1; then
    echo "FUSE 2 fehlt, installiere es (sudo-Passwort nötig) …"
    sudo apt-get update -qq
    sudo apt-get install -y libfuse2t64 2>/dev/null || sudo apt-get install -y libfuse2
  else
    echo "FUSE 2 (libfuse.so.2) fehlt. Bitte über die Paketverwaltung installieren." >&2
    exit 1
  fi
fi

echo "Suche neueste Version …"
json="$(curl -fsSL "$API" 2>/dev/null || true)"
if [[ -z "$json" ]]; then
  echo "Das Release konnte nicht abgefragt werden ($API)." >&2
  echo "Ist das Repository öffentlich und gibt es ein veröffentlichtes Release?" >&2
  exit 1
fi
url="$(printf '%s' "$json" | grep -oE '"browser_download_url": *"[^"]+_amd64\.AppImage"' | head -n 1 | sed -E 's/.*"(https[^"]+)"/\1/' || true)"
if [[ -z "$url" ]]; then
  echo "Kein AppImage im neuesten Release gefunden." >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
echo "Lade $(basename "$url") …"
curl -fSL --progress-bar "$url" -o "$tmp"
chmod +x "$tmp"

# Laufende Instanz beenden, dann ersetzen
pkill -x zentime >/dev/null 2>&1 || true
sleep 1
mv -f "$tmp" "$DEST"
trap - EXIT

# Icon aus dem AppImage holen und Menüeintrag anlegen
icon_dir="$HOME/.local/share/icons"
mkdir -p "$icon_dir" "$HOME/.local/share/applications"
if (cd "$(mktemp -d)" && "$DEST" --appimage-extract zentime.png >/dev/null 2>&1 && cp squashfs-root/zentime.png "$icon_dir/zentime.png"); then
  icon="$icon_dir/zentime.png"
else
  icon="calendar"
fi
cat > "$HOME/.local/share/applications/zentime.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=zentime
Comment=Kalender-Widget: wann ist heute der nächste Termin?
Exec=$DEST
Icon=$icon
Terminal=false
Categories=Office;Calendar;
StartupWMClass=zentime
EOF
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true

echo "zentime installiert: $DEST"
echo "Hinweise: GNOME zeigt das Tray-Icon nur mit der Erweiterung «AppIndicator Support»."
echo "          Bleibt das Fenster leer (NVIDIA): WEBKIT_DISABLE_DMABUF_RENDERER=1 $DEST"
nohup "$DEST" >/dev/null 2>&1 &
disown || true
