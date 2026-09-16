# Planbar und andere ICS-Feeds

Jede ICS-Adresse (`https://…` oder `webcal://…`) funktioniert in zentime als Quelle. Hier die Einrichtung für Planbar; andere Systeme (Outlook-Kalenderveröffentlichung, Nextcloud, Apple iCloud «Öffentlicher Kalender») laufen gleich.

## Planbar-Wochenplan

Planbar bietet pro Benutzer einen persönlichen iCal-Feed mit den eingeplanten Zeitblöcken des Wochenplans.

1. In Planbar oben rechts **Profil** öffnen
2. Abschnitt **Kalender-Feed** → **Feed-Adresse erzeugen** (oder die bestehende kopieren)
3. Adresse der Form `https://planbar.dev/api/ical/<token>` kopieren
4. In zentime: Zahnrad → **Quelle hinzufügen** → **ICS-Kalender**, Anzeigename «Planbar», Adresse einfügen, **Kalender hinzufügen**

Der Token in der Adresse ist ein Geheimnis. zentime speichert ihn nur im Schlüsselbund. In Planbar kann der Token jederzeit neu erzeugt oder gelöscht werden; die alte Adresse ist danach ungültig.

## Was zentime daraus macht

- Jeder Wochenplan-Slot erscheint als Termin mit Beginn und Ende
- Der Zusatz «(2h)» im Titel, den Planbar für externe Kalender anhängt, wird entfernt, weil die Tagesleiste die Dauer bereits zeigt
- Der Link zum Ticket steht hinter **Öffnen** im Detailraster
- Outlook-Termine, die Planbar im Wochenplan spiegelt, sind nicht im Feed enthalten. Sie kommen in zentime direkt über die Microsoft-365-Quelle, damit nichts doppelt erscheint

Nicht im Feed: Abwesenheiten, Sitzungen, Meilensteine und Aufgaben-Deadlines.

## webcal-Adressen

`webcal://`-Adressen werden beim Speichern zu `https://` umgeschrieben. Nur verschlüsselte Adressen (`https`) werden akzeptiert.
