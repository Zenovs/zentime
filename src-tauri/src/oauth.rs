//! Loopback-Listener für den OAuth-Redirect (Pflichtenheft 5.1).
//!
//! `oauth_start` bindet 127.0.0.1 an einen freien Port, `oauth_wait` nimmt den
//! Browser-Redirect an, antwortet mit einer kleinen Bestätigungsseite und
//! liefert die vollständige Redirect-URL an das Frontend. Der Code wird hier
//! nicht interpretiert und nicht geloggt.

use std::collections::HashMap;
use std::io::{ErrorKind, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

struct Listener {
    inner: TcpListener,
    cancelled: AtomicBool,
}

#[derive(Default)]
pub struct OauthState {
    listeners: Mutex<HashMap<u16, Arc<Listener>>>,
}

const SUCCESS_HTML: &str = r#"<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>zentime</title>
<style>body{margin:0;height:100vh;display:grid;place-items:center;font-family:Inter,-apple-system,system-ui,sans-serif;background:#EBEBEB;color:#1E1E1E}
@media (prefers-color-scheme:dark){body{background:#262626;color:#F2F2F2}} p{color:#8A8A8A;max-width:32em;text-align:center}</style></head>
<body><div><h1 style="font-size:20px;font-weight:600;text-align:center">Anmeldung abgeschlossen</h1>
<p>Du kannst dieses Fenster schliessen und zu zentime zurückkehren.</p></div></body></html>"#;

#[tauri::command]
pub fn oauth_start(state: tauri::State<'_, OauthState>) -> Result<u16, String> {
    let inner = TcpListener::bind(("127.0.0.1", 0)).map_err(|e| format!("Loopback-Port: {e}"))?;
    inner.set_nonblocking(true).map_err(|e| e.to_string())?;
    let port = inner.local_addr().map_err(|e| e.to_string())?.port();

    let mut map = state.listeners.lock().map_err(|_| "Zustand gesperrt")?;
    // Es läuft immer nur eine Anmeldung: liegengebliebene Listener (z. B. nach
    // einem Neuladen des Fensters) abbrechen und freigeben.
    for (_, old) in map.drain() {
        old.cancelled.store(true, Ordering::SeqCst);
    }
    map.insert(
        port,
        Arc::new(Listener {
            inner,
            cancelled: AtomicBool::new(false),
        }),
    );
    log::info!("oauth: Loopback auf Port {port}");
    Ok(port)
}

#[tauri::command]
pub async fn oauth_wait(
    state: tauri::State<'_, OauthState>,
    port: u16,
    timeout_ms: u64,
) -> Result<String, String> {
    let listener = state
        .listeners
        .lock()
        .map_err(|_| "Zustand gesperrt")?
        .get(&port)
        .cloned()
        .ok_or_else(|| "Kein Listener für diesen Port".to_string())?;

    let result = tauri::async_runtime::spawn_blocking(move || {
        wait_for_redirect(&listener, port, Duration::from_millis(timeout_ms))
    })
    .await
    .map_err(|e| e.to_string())?;

    if let Ok(mut map) = state.listeners.lock() {
        map.remove(&port);
    }
    result
}

#[tauri::command]
pub fn oauth_cancel(state: tauri::State<'_, OauthState>, port: u16) -> Result<(), String> {
    if let Some(l) = state
        .listeners
        .lock()
        .map_err(|_| "Zustand gesperrt")?
        .remove(&port)
    {
        l.cancelled.store(true, Ordering::SeqCst);
    }
    Ok(())
}

fn wait_for_redirect(listener: &Listener, port: u16, timeout: Duration) -> Result<String, String> {
    let deadline = Instant::now() + timeout;
    loop {
        if listener.cancelled.load(Ordering::SeqCst) {
            return Err("Anmeldung abgebrochen".into());
        }
        if Instant::now() >= deadline {
            return Err("Zeitüberschreitung: keine Antwort vom Browser".into());
        }
        match listener.inner.accept() {
            Ok((stream, _)) => {
                if let Some(url) = handle_connection(stream, port) {
                    return Ok(url);
                }
            }
            Err(e) if e.kind() == ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(50))
            }
            Err(e) => return Err(format!("Loopback-Fehler: {e}")),
        }
    }
}

/// Erkennt den OAuth-Redirect: `GET /?code=…&state=…` oder `GET /?error=…`.
fn is_oauth_redirect(target: &str) -> bool {
    let Some((path, query)) = target.split_once('?') else {
        return false;
    };
    if path != "/" && !path.is_empty() {
        return false;
    }
    query
        .split('&')
        .any(|kv| kv.starts_with("code=") || kv.starts_with("error="))
}

/// Liest einen HTTP-Request und antwortet. Liefert die Redirect-URL nur für den
/// eigentlichen OAuth-Redirect; alles andere (favicon, fremde Requests) erhält
/// 404 und der Listener wartet weiter.
fn handle_connection(mut stream: TcpStream, port: u16) -> Option<String> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let mut buf = vec![0u8; 8192];
    let n = stream.read(&mut buf).ok()?;
    let request = String::from_utf8_lossy(&buf[..n]);
    let first_line = request.lines().next()?;
    let mut parts = first_line.split_whitespace();
    let method = parts.next()?;
    let target = parts.next()?;

    if method != "GET" || !is_oauth_redirect(target) {
        let _ = stream
            .write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
        return None;
    }

    let body = SUCCESS_HTML.as_bytes();
    let header = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\nCache-Control: no-store\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(body);
    let _ = stream.flush();
    Some(format!("http://localhost:{port}{target}"))
}

#[cfg(test)]
mod tests {
    use super::is_oauth_redirect;

    #[test]
    fn erkennt_redirects() {
        assert!(is_oauth_redirect("/?code=abc&state=xyz"));
        assert!(is_oauth_redirect("/?error=access_denied&state=xyz"));
        assert!(!is_oauth_redirect("/?x=1"));
        assert!(!is_oauth_redirect("/favicon.ico"));
        assert!(!is_oauth_redirect("/other?code=abc"));
    }
}
