# zentime

Kalender-Widget für Linux und macOS. Es zeigt auf einen Blick, wann heute der nächste Termin ist, führt Termine aus Microsoft 365 und ICS-Kalendern (Google, Planbar, beliebige Feeds) zusammen und zeigt ausschliesslich den aktuellen Tag. Minimalistisches Design in Hell und Dunkel.

Die Software läuft komplett lokal, braucht keinen eigenen Server und sendet keine Telemetrie. Netzwerkverbindungen gehen nur zu `login.microsoftonline.com`, `graph.microsoft.com` und den eingetragenen ICS-Hosts.

## Funktionen

- **Hero**: Restzeit des laufenden Termins, Wartezeit bis zum nächsten («42 min») oder dessen Startzeit («14:30»), sonst «frei» mit Morgen-Vorschau
- **Tagesleiste**: eine Spalte pro Termin mit Startzeit, Icon (Video, Ort, Punkt) und Dauer; vergangene Termine gedimmt, überlappende in eigenen Spalten
- **Detailraster**: Beginn, Ende, Ort bzw. Meeting-Link, Kalender, «Noch heute», «Nächste Lücke»; Buttons «Beitreten» und «Öffnen»
- **Ganztägige Termine** als schmale Zeile über der Tagesleiste
- **Quellen**: Microsoft 365 über Microsoft Graph (OAuth 2.0 mit PKCE, kein Client-Secret) und beliebig viele ICS-Adressen (Google «Geheime Adresse», Planbar-Wochenplan, Outlook-Veröffentlichungen)
- Wiederholungen mit EXDATE, verschobenen Einzelterminen (RECURRENCE-ID) und Absagen; VTIMEZONE und Zeitumstellung
- Aktualisierung alle 5 Minuten (Graph) bzw. 15 Minuten (ICS, mit ETag), manuell mit `Cmd/Ctrl+R`
- Offline-Cache mit Hinweis «Stand 14:05», Tageswechsel um Mitternacht, Neuladen nach Standby
- Abgesagte Termine ausgeblendet, abgelehnte umschaltbar; private Termine zeigen nur «Privat»
- Hell/Dunkel folgt dem System, manuell übersteuerbar
- Rahmenloses, verschiebbares Fenster; Position und Grösse werden gespeichert; «Immer im Vordergrund» umschaltbar
- Tray- bzw. Menüleisten-Icon, Autostart, Privatmodus (`Cmd/Ctrl+Shift+P`) für Bildschirmfreigaben
- Secrets (Refresh-Tokens, ICS-Adressen) nur im Schlüsselbund (macOS Keychain, Linux Secret Service)
- Auto-Update: beim Start und danach täglich prüft die App das neueste GitHub-Release, lädt signierte Updates und startet neu (abschaltbar in den Einstellungen)

## Installation

Fertige Pakete liegen unter [Releases](https://github.com/Zenovs/zentime/releases): `.dmg` (macOS 13+, Universal), `.AppImage` und `.deb` (Ubuntu 24.04, x86_64).

### macOS

Die App ist nicht signiert. Gatekeeper blockiert sie deshalb beim ersten Start.

1. `.dmg` öffnen, `zentime.app` nach `/Applications` ziehen
2. Rechtsklick auf die App → **Öffnen** → im Dialog erneut **Öffnen**

Alternativ im Terminal:

```sh
xattr -dr com.apple.quarantine /Applications/zentime.app
```

zentime zeigt kein Dock-Icon; es lebt in der Menüleiste (Icon «z»). Über das Menü lässt sich das Widget zeigen und verbergen, aktualisieren, die Einstellungen öffnen und die App beenden.

### Linux (Ubuntu 24.04)

**AppImage**

```sh
chmod +x zentime_*.AppImage
./zentime_*.AppImage
```

**deb**

```sh
sudo apt install ./zentime_*.deb
```

Voraussetzungen und Hinweise:

- **Schlüsselbund**: Es muss ein Secret Service laufen (GNOME Keyring, bei Ubuntu Standard).
- **Tray-Icon**: GNOME zeigt Tray-Icons nur mit der Erweiterung «AppIndicator and KStatusNotifierItem Support». Ohne Tray ist das Widget trotzdem voll bedienbar: Einstellungen über das Zahnrad im Widget, Beenden über `Cmd/Ctrl+Q` im Widget bzw. das Systemmenü.
- **Wayland**: GNOME ignoriert unter Wayland «Immer im Vordergrund» und Fensterpositionen. zentime startet deshalb automatisch über XWayland (`GDK_BACKEND=x11`). Wer natives Wayland will, setzt `ZENTIME_NATIVE_WAYLAND=1`, verzichtet dann aber auf Position und Vordergrund.
- **Leeres Fenster** (v. a. NVIDIA): `WEBKIT_DISABLE_DMABUF_RENDERER=1 ./zentime_*.AppImage`
- **Runde Ecken** brauchen einen Compositor; ohne Compositor sind die Ecken eckig.

## Quellen einrichten

- **Microsoft 365**: [docs/setup-microsoft.md](docs/setup-microsoft.md) beschreibt die App-Registrierung in Entra ID (einmalig, ohne Client-Secret) und das Eintragen von Client-ID und Tenant-ID in zentime.
- **Google Kalender**: [docs/setup-google.md](docs/setup-google.md) zeigt, wo die «Geheime Adresse im iCal-Format» zu finden ist.
- **Planbar** und andere ICS-Feeds: [docs/setup-planbar.md](docs/setup-planbar.md).

Alle Secrets bleiben lokal im Schlüsselbund. Client-ID und Tenant-ID stehen in der Einstellungsdatei, sind aber keine Geheimnisse.

## Bedienung

| Aktion | Wie |
|---|---|
| Fenster verschieben | Kopfzeile ziehen |
| Termin im Detailraster wählen | Spalte in der Tagesleiste anklicken |
| Aktualisieren | `Cmd/Ctrl+R` oder Tray-Menü |
| Einstellungen | Zahnrad, `Cmd/Ctrl+,` oder Tray-Menü |
| Hell/Dunkel | Sonne/Mond-Icon; Systemfolge in den Einstellungen |
| Privatmodus | `Cmd/Ctrl+Shift+P` |
| Zurück zur Tagesansicht | `Esc` |
| Fenster schliessen | verbirgt das Widget; Beenden über das Tray-Menü |
| Updates | Einstellungen → Updates: automatisch (Standard) oder «Jetzt prüfen» |

## Entwicklung

Voraussetzungen: Node 22, pnpm 11, Rust stable, plus die [Tauri-Systemabhängigkeiten](https://tauri.app/start/prerequisites/) (auf Ubuntu zusätzlich `libdbus-1-dev` für den Schlüsselbund).

```sh
pnpm install
pnpm tauri dev        # App mit Hot Reload
pnpm dev              # nur Frontend im Browser, Demo-Daten mit http://localhost:1420/?demo&now=09:35
pnpm test             # Vitest
pnpm typecheck
pnpm lint
pnpm tauri build      # Pakete in src-tauri/target/release/bundle (braucht den Signaturschlüssel, siehe Release)
```

Demo-Parameter im Browser: `?demo=tag|leer|ganztags|mehrere`, `&now=HH:MM`, `&theme=light|dark`.

### Aufbau

```
src/
  logic/        hero.ts, timeline.ts, gaps.ts, day.ts   reine Funktionen, getestet
  sources/      ics.ts, graph.ts, msauth.ts, merge.ts   Quellen ohne Tauri-Abhängigkeit
  platform/     Tauri-Anbindung: Schlüsselbund, Store, HTTP, Loopback, Fenster
  app/          Zustand (zustand), Sync-Engine, Theme, Demo-Daten
  components/   React-Oberfläche
src-tauri/      Rust: Fenster, Tray, OAuth-Loopback, Keyring
tests/          Vitest, Fixtures anonymisiert
docs/           Einrichtungsanleitungen
design/         M0-Mockup (Design-Canvas) und App-Icon
```

### Release und Auto-Update

Jeder Push auf `main` (ausser Änderungen nur an `docs/`, `design/` oder Markdown) wird durch [release.yml](.github/workflows/release.yml) zu einem Release:

1. Lint, Typecheck und Tests laufen als Gate.
2. Die nächste Version wird bestimmt: Patch-Stelle des neuesten Tags plus eins, oder die Version aus `package.json`, falls sie höher ist (für einen manuellen Sprung auf 1.1.0 also nur `package.json` anpassen).
3. Der Workflow schreibt die Version in `package.json`, `Cargo.toml` und `Cargo.lock`, committet `release: vX.Y.Z` und setzt den Tag.
4. Linux (`ubuntu-22.04`: `.AppImage`, `.deb`) und macOS (Universal: `.dmg`) werden gebaut, die Updater-Artefakte mit dem Minisign-Schlüssel signiert und `latest.json` erzeugt.
5. Das Release wird veröffentlicht. Installierte Apps finden es beim nächsten Start über `releases/latest/download/latest.json`.

Der Updater funktioniert für die `.app` auf macOS und das AppImage auf Linux. Eine `.deb`-Installation aktualisiert sich nicht selbst; dort meldet die Einstellungsseite «Prüfung fehlgeschlagen».

**Signaturschlüssel:** Der private Schlüssel liegt als GitHub-Secret `TAURI_SIGNING_PRIVATE_KEY` (mit `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) und lokal unter `~/.tauri/zentime.key`. Er darf nicht verloren gehen, sonst können bereits installierte Apps keine Updates mehr annehmen. Der öffentliche Schlüssel steht in `src-tauri/tauri.conf.json` unter `plugins.updater.pubkey`.

Lokaler Release-Build mit Signatur:

```sh
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/zentime.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="$(security find-generic-password -a zentime -s zentime-updater-key -w)"
pnpm tauri build
```

Ohne diese Variablen bricht `pnpm tauri build` ab, weil `createUpdaterArtifacts` aktiv ist. Für einen Debug-Lauf ohne Bundle reicht `pnpm tauri dev`.

## Datenschutz

- Keine Telemetrie, kein eigener Server, keine Benutzerkonten
- Tokens und ICS-Adressen nur im Schlüsselbund; Einstellungen als JSON im App-Config-Verzeichnis
- Der Offline-Cache (letzter Stand der Termine) liegt im App-Config-Verzeichnis
- Logdatei rotierend im App-Log-Verzeichnis, ohne Termininhalte

## Lizenz

MIT, siehe [LICENSE](LICENSE).
