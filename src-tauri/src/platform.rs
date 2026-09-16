//! Plattform-Besonderheiten (Pflichtenheft 9).

/// Muss vor dem Start von GTK laufen.
pub fn prepare_env() {
    #[cfg(target_os = "linux")]
    {
        // GNOME unter Wayland ignoriert «Immer im Vordergrund» und gesetzte
        // Fensterpositionen. Das Widget läuft deshalb über XWayland, solange
        // niemand ZENTIME_NATIVE_WAYLAND setzt (9.1).
        if std::env::var_os("GDK_BACKEND").is_none()
            && std::env::var_os("WAYLAND_DISPLAY").is_some()
            && std::env::var_os("ZENTIME_NATIVE_WAYLAND").is_none()
        {
            std::env::set_var("GDK_BACKEND", "x11");
        }

        // Bei transparenten Fenstern zeichnet der DMABUF-Renderer von WebKitGTK
        // neue Frames über den alten Inhalt, statt die Fläche vorher zu löschen.
        // Sichtbar wird das, sobald die Tagesansicht mit Deckkraft < 100 % auf
        // eine zuvor deckende Ansicht folgt: die alte Seite bleibt als
        // Geisterbild stehen, statt den Desktop durchscheinen zu lassen.
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }
}

/// Fenster-Eigenschaften, die sich nicht über `tauri.conf.json` setzen lassen.
#[allow(unused_variables)]
pub fn configure_window(window: &tauri::WebviewWindow) {
    #[cfg(target_os = "macos")]
    {
        // Widget auf allen Spaces sichtbar (9.2, Soll).
        use objc2_app_kit::{NSWindow, NSWindowCollectionBehavior};
        if let Ok(ptr) = window.ns_window() {
            // SAFETY: `ns_window` liefert einen gültigen NSWindow-Zeiger; wir sind im Main-Thread (setup).
            unsafe {
                let ns: &NSWindow = &*(ptr as *const NSWindow);
                let behavior = ns.collectionBehavior()
                    | NSWindowCollectionBehavior::CanJoinAllSpaces
                    | NSWindowCollectionBehavior::FullScreenAuxiliary;
                ns.setCollectionBehavior(behavior);
            }
        }
    }
}

/// Das Frontend blendet das Fenster nach dem ersten Rendern ein (kein Flackern).
/// Falls das ausbleibt, etwa weil der WebView nicht lädt, zeigt dieser Fallback
/// das Fenster nach einigen Sekunden trotzdem, damit die App nie unsichtbar bleibt.
pub fn show_fallback(window: tauri::WebviewWindow) {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(4));
        if !window.is_visible().unwrap_or(true) {
            log::warn!("Fenster wurde vom Frontend nicht eingeblendet, Fallback greift");
            let _ = window.show();
        }
    });
}
