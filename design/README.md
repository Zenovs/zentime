# Design

## m0-mockup

Mockup aus Meilenstein M0: 18 Artboards (9 Screens in Hell und Dunkel) als Design-Canvas.

- `build.mjs` erzeugt alle `*.dc.html`-Artboards und `canvas.json` aus einer Datenbeschreibung. Anpassungen an Tokens, Texten oder Zuständen laufen über dieses Skript: `node design/m0-mockup/build.mjs`
- Die Artboards sind eigenständige HTML-Dateien und lassen sich direkt im Browser öffnen.
- Beispieldaten sind erfunden; es sind keine echten Termine enthalten.

## icon

- `app-icon.html` → `app-icon.png` (1024 × 1024, transparenter Hintergrund). Daraus erzeugt `pnpm tauri icon design/icon/app-icon.png` die Icons in `src-tauri/icons/`.
- `tray-icon.html` → `tray-512.png` → `tray-44.png` (monochrom, als Template-Icon für die macOS-Menüleiste). Kopie liegt unter `src-tauri/icons/tray.png`.

Beide HTML-Dateien werden mit Headless Chrome gerendert, zum Beispiel:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --default-background-color=00000000 \
  --window-size=1024,1024 --screenshot=design/icon/app-icon.png design/icon/app-icon.html
```
