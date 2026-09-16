# Microsoft 365 einrichten

zentime liest Kalender über Microsoft Graph. Dafür braucht es eine App-Registrierung in Entra ID. Sie wird einmal pro Tenant angelegt; danach trägt jede Person Client-ID und Tenant-ID in zentime ein. Es gibt kein Client-Secret, zentime ist ein öffentlicher Client mit PKCE.

## 1. App registrieren (Admin, einmalig)

1. [Microsoft Entra Admin Center](https://entra.microsoft.com) → **Identität** → **Anwendungen** → **App-Registrierungen** → **Neue Registrierung**
2. Einstellungen:

   | Einstellung | Wert |
   |---|---|
   | Name | `zentime` |
   | Unterstützte Kontotypen | **Nur Konten in diesem Organisationsverzeichnis** (Single Tenant) |
   | Umleitungs-URI | Plattform **Mobile Anwendungen und Desktopanwendungen**, URI `http://localhost` |

   Wichtig: Die Plattform muss «Mobile und Desktopanwendungen» sein. Bei «Web» verlangt Entra ein Client-Secret, das zentime nicht verwendet. `http://localhost` ohne Port genügt; Entra akzeptiert bei localhost jeden Port, zentime wählt beim Login einen freien.

3. **Registrieren** klicken. Auf der Übersichtsseite stehen **Anwendungs-ID (Client)** und **Verzeichnis-ID (Mandant)**. Beide Werte werden in zentime gebraucht.

## 2. Berechtigungen

1. **API-Berechtigungen** → **Berechtigung hinzufügen** → **Microsoft Graph** → **Delegierte Berechtigungen**
2. Auswählen: `User.Read`, `Calendars.Read`, `offline_access` (und `openid`, `profile`, falls nicht schon vorhanden)
3. **Administratorzustimmung für <Tenant> erteilen** klicken, damit niemand beim ersten Login einzeln zustimmen muss

`Calendars.Read` reicht für eigene Kalender und für freigegebene Kalender, die im eigenen Postfach eingebunden sind. Für Kalender anderer Postfächer wäre `Calendars.Read.Shared` nötig (in zentime noch nicht vorgesehen).

## 3. Authentifizierung prüfen

Unter **Authentifizierung**:

- Plattform «Mobile Anwendungen und Desktopanwendungen» mit `http://localhost`
- **Öffentliche Clientflows zulassen**: kann auf «Nein» bleiben, PKCE braucht das nicht
- Keine implizite Gewährung

## 4. In zentime eintragen

1. zentime öffnen → Zahnrad → **Quelle hinzufügen** → **Microsoft 365**
2. Anzeigename (z. B. «Arbeit»), **Client-ID** und **Tenant-ID** eintragen
3. **Mit Microsoft anmelden**: Der Systembrowser öffnet die Anmeldung. Nach dem Login zeigt der Browser «Anmeldung abgeschlossen», das Fenster kann geschlossen werden.
4. zentime lädt die Kalenderliste. In der Quellenansicht wählst du, welche Kalender angezeigt werden.

Was gespeichert wird:

| Wert | Ort |
|---|---|
| Client-ID, Tenant-ID, Kalenderauswahl, Kontoname | `settings.json` im App-Config-Verzeichnis |
| Refresh-Token | Schlüsselbund (macOS Keychain, Linux Secret Service) |
| Access-Token | nur im Speicher |

## Fehlerbehebung

- **«AADSTS50011: Die Antwort-URL stimmt nicht überein»**: Die Redirect-URI `http://localhost` fehlt oder ist unter der Plattform «Web» statt «Mobile und Desktop» eingetragen.
- **«AADSTS7000218: client_assertion or client_secret»**: Die Plattform ist «Web». Entferne sie und lege die Redirect-URI unter «Mobile Anwendungen und Desktopanwendungen» an.
- **«Neu anmelden» in den Einstellungen**: Der Refresh-Token ist abgelaufen oder wurde widerrufen (z. B. Passwortwechsel, Conditional Access). In der Quellenansicht **Neu anmelden** wählen; andere Quellen laufen weiter.
- **HTTP 403**: `Calendars.Read` fehlt oder die Administratorzustimmung wurde nicht erteilt.
- **Der Browser öffnet sich nicht**: zentime nutzt den Standardbrowser des Systems. Die Login-URL erscheint bei Problemen im Log (ohne Code oder Token).

## Hinweis zu Zeiten

zentime fragt Graph ohne `Prefer: outlook.timezone` ab, erhält die Zeiten in UTC und rechnet lokal in die Systemzeitzone um. Ganztägige Termine gelten am lokalen Kalendertag.
