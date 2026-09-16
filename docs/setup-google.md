# Google Kalender einrichten

zentime liest Google Kalender über die «Geheime Adresse im iCal-Format». Dafür braucht es kein Google-Cloud-Projekt und keine OAuth-App.

## Geheime Adresse finden

1. [Google Kalender](https://calendar.google.com) im Browser öffnen
2. Oben rechts **Einstellungen** (Zahnrad) → **Einstellungen**
3. Links unter **Einstellungen für meine Kalender** den gewünschten Kalender anklicken
4. Zum Abschnitt **Kalender integrieren** scrollen
5. **Geheime Adresse im iCal-Format** kopieren (beginnt mit `https://calendar.google.com/calendar/ical/…/private-…/basic.ics`)

Die Adresse gewährt Lesezugriff auf den gesamten Kalender. Behandle sie wie ein Passwort. Unter «Geheime Adresse zurücksetzen» kann sie jederzeit ungültig gemacht werden.

## In zentime eintragen

1. Zahnrad → **Quelle hinzufügen** → **ICS-Kalender**
2. Anzeigename (z. B. «Privat») und die kopierte Adresse eintragen
3. **Kalender hinzufügen**: zentime lädt den Feed einmal zur Prüfung und speichert die Adresse im Schlüsselbund

Mehrere Google-Kalender werden als mehrere Quellen eingetragen, jede mit eigener Farbmarkierung.

## Was zentime aus dem Feed liest

- Termine von heute und morgen, Wiederholungen expandiert, mit EXDATE, verschobenen Einzelterminen und Absagen
- Ganztägige Termine (auch mehrtägige)
- Ort, Google-Meet-Link (`X-GOOGLE-CONFERENCE`), Sichtbarkeit «privat» (`CLASS:PRIVATE` → zeigt «Privat»), «verfügbar» (`TRANSP:TRANSPARENT`)
- Zu- oder Absagen einzelner Teilnehmenden kann der Feed nicht pro Person zuordnen; abgelehnte Google-Einladungen erscheinen nur, wenn sie noch im Kalender stehen

Der Feed wird alle 15 Minuten geholt, mit `If-None-Match`, sofern Google ein ETag liefert. Google aktualisiert die geheime Adresse selbst mit einigen Minuten Verzögerung; Änderungen erscheinen deshalb nicht sekundengenau.

## Google Workspace

Bei Workspace-Konten kann der Admin die geheime Adresse deaktivieren (Admin-Konsole → Apps → Google Workspace → Kalender → Freigabeeinstellungen). Fehlt der Abschnitt «Geheime Adresse», ist das der Grund. In dem Fall bleibt nur ein Zugriff über die Google Calendar API mit OAuth, der in zentime noch nicht umgesetzt ist.
