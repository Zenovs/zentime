# Microsoft 365 einrichten

zentime liest Kalender über Microsoft Graph. Dafür braucht es eine App-Registrierung in Entra ID. Sie wird einmal pro Tenant angelegt; danach trägt jede Person Client-ID und Tenant-ID in zentime ein. Es gibt kein Client-Secret, zentime ist ein öffentlicher Client mit PKCE.

## 1. App registrieren (Admin, einmalig)

### Schnellweg: ein Befehl in der Azure Cloud Shell

1. [shell.azure.com](https://shell.azure.com) öffnen und mit dem Admin-Konto anmelden (Bash wählen)
2. Diesen Befehl einfügen; er legt die Registrierung mit allen Einstellungen an, erteilt die Administratorzustimmung und gibt am Ende die **Client-ID** aus:

```sh
APP_ID=$(az ad app create --display-name zentime --sign-in-audience AzureADMyOrg \
  --is-fallback-public-client true --public-client-redirect-uris http://localhost \
  --required-resource-accesses '[{"resourceAppId":"00000003-0000-0000-c000-000000000000","resourceAccess":[
    {"id":"e1fe6dd8-ba31-4d61-89e7-88639da4683d","type":"Scope"},
    {"id":"465a38f9-76ea-45b9-9f34-9e8b0d4b0b42","type":"Scope"},
    {"id":"7427e0e9-2fba-42fe-b0c0-848c9e6a8182","type":"Scope"}]}]' \
  --query appId -o tsv) \
&& az ad sp create --id "$APP_ID" >/dev/null \
&& sleep 15 && az ad app permission admin-consent --id "$APP_ID" \
&& echo "Client-ID: $APP_ID"
```

Die drei Scope-IDs stehen für `User.Read`, `Calendars.Read` und `offline_access` von Microsoft Graph. Die Client-ID aus der letzten Zeile kommt in zentime ins Feld **Client-ID**; als zweites Feld reicht die eigene E-Mail-Adresse, das Verzeichnis ermittelt zentime daraus.

### Alternativ von Hand im Portal

1. [Microsoft Entra Admin Center](https://entra.microsoft.com) → **Identität** → **Anwendungen** → **App-Registrierungen** → **Neue Registrierung**
2. Einstellungen:

   | Einstellung | Wert |
   |---|---|
   | Name | `zentime` |
   | Unterstützte Kontotypen | **Nur Konten in diesem Organisationsverzeichnis** (Single Tenant) |
   | Umleitungs-URI | Plattform **Mobile Anwendungen und Desktopanwendungen**, URI `http://localhost` |

   Wichtig: Die Plattform muss «Mobile und Desktopanwendungen» sein. Bei «Web» verlangt Entra ein Client-Secret, das zentime nicht verwendet. `http://localhost` ohne Port genügt; Entra akzeptiert bei localhost jeden Port, zentime wählt beim Login einen freien.

3. **Registrieren** klicken. Auf der Übersichtsseite steht die **Anwendungs-ID (Client)**. Die **Verzeichnis-ID (Mandant)** braucht zentime nur, wenn die automatische Ermittlung aus der E-Mail-Domäne fehlschlägt («Erweitert»).

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
2. **Client-ID** und die eigene **E-Mail-Adresse** eintragen (Anzeigename optional). Das Verzeichnis ermittelt zentime aus der Domäne der Adresse; nur wenn das fehlschlägt, unter «Erweitert» die Tenant-ID eintragen.
3. **Mit Microsoft anmelden**: Der Systembrowser öffnet die Anmeldung, das Konto ist bereits vorausgewählt. Nach dem Login zeigt der Browser «Anmeldung abgeschlossen», das Fenster kann geschlossen werden.
4. zentime lädt die Kalenderliste. In der Quellenansicht wählst du, welche Kalender angezeigt werden.

Was gespeichert wird:

| Wert | Ort |
|---|---|
| Client-ID, Tenant-ID, Kalenderauswahl, Kontoname | `settings.json` im App-Config-Verzeichnis |
| Refresh-Token | Schlüsselbund (macOS Keychain, Linux Secret Service) |
| Access-Token | nur im Speicher |

## Fehlerbehebung

- **«AADSTS90002: Tenant … not found»**: Unter «Erweitert» steht ein Wert, der kein Verzeichnis ist, meist die Anwendungs-ID. Feld leeren und die E-Mail-Adresse verwenden; zentime ermittelt das Verzeichnis dann selbst.
- **«AADSTS700016: Application … was not found in the directory»**: Die Client-ID gehört zu keiner Registrierung in diesem Verzeichnis. Client-ID prüfen oder die Registrierung im richtigen Tenant anlegen.
- **«AADSTS65001» oder Zustimmungsdialog**: Die Administratorzustimmung fehlt. Im Portal unter API-Berechtigungen erteilen oder den Cloud-Shell-Befehl oben ausführen.
- **«AADSTS50011: Die Antwort-URL stimmt nicht überein»**: Die Redirect-URI `http://localhost` fehlt oder ist unter der Plattform «Web» statt «Mobile und Desktop» eingetragen.
- **«AADSTS7000218: client_assertion or client_secret»**: Die Plattform ist «Web». Entferne sie und lege die Redirect-URI unter «Mobile Anwendungen und Desktopanwendungen» an.
- **«Neu anmelden» in den Einstellungen**: Der Refresh-Token ist abgelaufen oder wurde widerrufen (z. B. Passwortwechsel, Conditional Access). In der Quellenansicht **Neu anmelden** wählen; andere Quellen laufen weiter.
- **HTTP 403**: `Calendars.Read` fehlt oder die Administratorzustimmung wurde nicht erteilt.
- **Der Browser öffnet sich nicht**: zentime nutzt den Standardbrowser des Systems. Die Login-URL erscheint bei Problemen im Log (ohne Code oder Token).

## Hinweis zu Zeiten

zentime fragt Graph ohne `Prefer: outlook.timezone` ab, erhält die Zeiten in UTC und rechnet lokal in die Systemzeitzone um. Ganztägige Termine gelten am lokalen Kalendertag.
