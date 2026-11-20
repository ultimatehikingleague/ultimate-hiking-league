# Garmin Connect – Abnahme und Freigabe

## Freigabeentscheidung vom 15. November 2026

Die Hauptdomain zeigt auf Vercel-Deployment `dpl_3MXQHRAeL5UAkSbqWNs8DxtKRzD4` (`READY`). `GARMIN_SUBMISSION_ENABLED` fehlt in diesem Deployment. `20261123_garmin_private_review.sql` ist produktiv registriert. `20261122_garmin_publication_rounding.sql` ist lokal angepasst und noch nicht produktiv registriert. Für diesen Schritt wurden weder Produktionsdaten geschrieben noch Code oder Konfiguration veröffentlicht. Der Garmin- und Shop-Worker laufen laut Vercel-Konfiguration minütlich, der Shop-Statusabgleich alle 15 Minuten.

| Gezielter Live-Abgleich | Befund |
| --- | --- |
| Zugaktivität, 265,33 km, 595 hm, 03:57 | Kein privater Prüfstatus und keine FIT-Verifikation. Die lokale Kopie wird anhand ihrer ungerundeten Messwerte wegen 67,04 km/h abgelehnt. |
| Pilotwanderung, 0,92 km, 5 hm, 01:11 | Kein privater Prüfstatus und keine FIT-Verifikation. Die lokale Kopie unterschreitet beide Mindestwerte. |
| Freigabe | Gestoppt. Bei beiden vorhandenen Importen fehlt die gespeicherte Herkunftskette. Aus dem fehlenden Prüfdatensatz lässt sich nicht ableiten, ob Garmin in späteren Zustellungen `activityFiles.manual` liefert. |

Lokal führt ein konsistenter privater Prüfstatus mit explizitem `activityFiles.manual: false`, explizitem `isWebUpload: false` aus den Feeds und konsistenten Samples zur regulären Veröffentlichung. Der vorhandene FIT-Pfad bleibt für Altimporte mit vollständigem FIT- und Herkunftsnachweis verfügbar. Ein gespeicherter widersprüchlicher oder unvollständiger Prüfstatus sperrt die Automatik. Der Klick bindet die angezeigten Werte und den privaten Status an dieselbe Datenbanktransaktion. Der DB-Zweig übernimmt nur serverseitige Messwerte und sperrt konkurrierende Zustellungen während der Prüfung.

Der isolierte PostgreSQL-Test erzeugte mit 9,995 km, 599,5 hm und 7.259 Sekunden genau einen verifizierten Record über 10,00 km, 600 hm und 02:00. Er prüfte Hiker- und Site-Summen, Saisonrangliste, einmalig zehn Milestone-Punkte, Duplikate und Korrekturen. Die sechs gezielten Tests deckten außerdem die beiden bekannten Ablehnungsfälle, fehlendes `manual`, einen Feed-Widerspruch, einen zwischen Vorschau und Klick geänderten Prüfstatus sowie den Garmin-Berechtigungsentzug ab. Ein Live-Testrecord und eine neue 10-km-Wanderung waren für diese Prüfung entbehrlich.

## Umfang des Piloten

- Ein einziges, serverseitig konfiguriertes UHL-Konto anhand seiner Supabase-Auth-UUID. OAuth-Start, Callback, Kontozugriff, Push-Zuordnung und Worker-Claims prüfen diese Begrenzung. Fehlende oder ungültige UUID sperrt den Zugang.
- Private Importkacheln mit Garmin-Quellenhinweis. Die Browserrollen erhalten keinen Zugriff auf Importtabellen oder Rohdateien. Die Veröffentlichung ist standardmäßig gesperrt. Im lokalen Veröffentlichungspfad erzeugt erst der ausdrückliche Klick beim Hiker einen verifizierten, öffentlichen Record. Die bisherige private Prüfung betrifft ausschließlich bereits vorhandene Pilot-Einreichungen.
- UHL-Trennung wartet auf aktive Aufträge, versucht die Deregistrierung und löscht bei bestätigtem OAuth-`invalid_grant` lokal weiter. Temporäre Garmin-Fehler sind wiederholbar. Sobald die lokale Sperre gespeichert ist, bleiben weitere Importe auch bei einem Storage-Fehler gesperrt. Eine erneute Trennung setzt dann bei der Dateibereinigung fort.
- Rohdateien werden ab 24 Stunden zur Löschung fällig. Bei gelöschtem UHL-Konto entfernt die Auth-Kaskade Verbindung, Inbox und Importdaten. Der nächste Worker-Lauf findet zurückgebliebene Dateien über Storage-Metadaten, auch wenn das Konto bereits gelöscht wurde. Der Worker entfernt fällige, verwaiste oder gesperrte Rohdateien in Batches per Storage API und kann nach Fehlern erneut laufen. Die Dauer bis zur Löschung hängt von erfolgreichen Worker-Läufen ab. Normalisierte Importdaten bleiben bis zur Trennung oder Kontolöschung.
- Der bestätigte fachliche Parser für `ClientConsumerPermissions` prüft vollständige Berechtigungslisten und Zeitstempel. Unbekannte HTTP-Feeds werden vor dem Lesen des Bodys mit 404 abgewiesen.

## Lesender Abgleich mit Produktion

| Bereich | Befund |
| --- | --- |
| Migrationen | `20261114` bis `20261121` sind angewandt. Die produktive Publikationsfunktion verwendet die ungerundeten Messwerte und verarbeitet `custom_description`. Die lokale Folgemigration ist `20261122_garmin_publication_rounding.sql`. |
| Records | RLS aktiv. `SELECT` für `anon` und `authenticated` jeweils mit `true`. Null Zeilen mit `record_source = 'Garmin'` zum Prüfzeitpunkt. |
| Einreichungen | RLS aktiv. Eigentümer dürfen eigene Zeilen lesen und einfügen. Admins dürfen lesen und aktualisieren. Gesamtgröße 712 kB. |
| Aggregation | `hiker_season_stats` ist eine View über `records`. `site_stats` ist eine Tabelle. Records-Trigger aktualisieren Hiker- und Site-Statistiken und synchronisieren bzw. stornieren Prämienpunkte. Weitere Trigger berechnen Geschwindigkeit und Division. |
| Storage und Auth | `storage.objects` hat einen Schutztrigger gegen direktes Löschen. Die Garmin-Bereinigung nutzt deshalb die Storage API. In der Katalogabfrage kein nichtinterner Trigger auf `auth.users` oder `record_submissions`. |
| Backup | Jüngstes angezeigtes tägliches Backup 13.11.2026, 04:09:54 Uhr Berliner Zeit (03:09:54 UTC). Das Dashboard bestätigt die Verfügbarkeit. Datenbankbackups enthalten keine Storage-Dateiinhalte. |

[Supabase-Backups](https://supabase.com/dashboard/project/astdepkrdkmufsydxviz/database/backups/scheduled) · [Supabase-Dokumentation zu Backups](https://supabase.com/docs/guides/platform/backups)

## Garmin COMMON

Die UHL-App ist für Starter Access und die Activity API zugelassen. Garmin OAuth2 PKCE 2.0 beschreibt in Abschnitt 7 `deregistrations` mit `userId` und in Abschnitt 9 `userPermissionsChange` mit `userId`, `summaryId`, `permissions` und `changeTimeInSeconds`. Der Start Guide beschreibt HTTPS-POST mit JSON für Starter. Die Activity API 2.1 dokumentiert die Garmin-Absendernetze und für Push HTTP 200 innerhalb von 30 Sekunden sowie stündliche Wiederholung bis zu sieben Tage. [Garmin OAuth2 PKCE 2.0](https://developerportal.garmin.com/sites/default/files/OAuth2PKCE%202.0.pdf) · [Garmin Start Guide](https://developerportal.garmin.com/sites/default/files/Garmin%20Developer%20Program_Start_Guide_2.0_0.pdf) · [Activity API 2.1](https://developerportal.garmin.com/sites/default/files/Activity_API%202.1.pdf)

UHL prüft bei beiden Feeds dieselbe Garmin-IP-Liste wie für die Activity-Feeds und gleicht eine mitgesendete Garmin-Client-ID ab. HTTP 200 folgt auf die Datenbanktransaktion. Bei einem vorübergehenden Speicherfehler antwortet UHL mit 503. Die Vercel-Logs enthalten Feed, Ergebnis und Anzahl der verarbeiteten Einträge. Eine Deregistrierung enthält keinen Zeitstempel und keine Verbindungs-ID. Auch eine verspätete Zustellung kann daher eine neue Verbindung desselben Garmin-Kontos sperren. Eine erneute Berechtigungsnachricht hebt eine gespeicherte Sperre nicht auf.

Der lesende Abgleich bestätigte `GARMIN_PUSH_ENABLED=true` und `GARMIN_WORKER_ENABLED=true`. `GARMIN_SUBMISSION_ENABLED` fehlte in den Projektvariablen und im Live-Deployment. Der gespeicherte Schalterstand im Garmin-Portal wurde bei diesem Abgleich nicht erneut geprüft.

## Nächster Freigabeschritt

1. Die vollständige Herkunftskette aus einer regulären Garmin-Zustellung nachweisen. Eine kurze vorhandene Geräteaktivität genügt für diesen Nachweis, weil die Zulassungsgrenzen lokal geprüft sind. Entscheidend sind die gespeicherten Werte aus `activities`, `activityDetails` und `activityFiles`, einschließlich `manual: false`, `isWebUpload: false` und `samples-consistent`.
2. Falls der Herkunftsnachweis gelingt, ausschließlich `20261122_garmin_publication_rounding.sql` auf der bestehenden Instanz in einer Transaktion nachziehen und als angewandt erfassen. `20261123` bleibt bestehen. Die beiden produktiven Funktionsdefinitionen mit Eigentümern und Rechten sowie die bestehenden Records-Trigger wurden unter `release-garmin-private.sA1G21/db-publication-before.json` gesichert. Der kostenfreie Rückweg liegt daneben als `db-publication-rollback.sql`. Die Wiederherstellung der exportierten Definitionen und der Erhalt von `20261123` wurden in isoliertem PostgreSQL geprüft.
3. Vom erneut bestätigten Live-Quellstand einen Kandidaten mit den Garmin-Änderungen erstellen und den gemeinsamen Produktionsrelease prüfen. Für einen Rückweg zuerst die Veröffentlichung am App-Deployment sperren und auf `dpl_3MXQHRAeL5UAkSbqWNs8DxtKRzD4` zurückschalten. Danach das gezielte SQL-Rollback ausführen. Es stellt die beiden Funktionsdefinitionen wieder her, entfernt den neuen Garmin-Tempo-Trigger mit Funktion und entfernt nur `20261122` aus dem Migrationsverzeichnis der Datenbank. [Gemeinsamer Produktionsrelease](production-release.md)

## Lokale Prüfung

95 Tests einschließlich separatem lokalem PayPal-Relay-Lauf bestanden. Zwei OCR-Bildtests wurden mangels Originaldateien übersprungen. TypeScript, gezieltes Lint und `git diff --check` bestanden.

```sh
PGLITE_MODULE=/absoluter/pfad/zu/pglite/dist/index.js node --import tsx --test tests/*.test.*
./node_modules/.bin/tsc --noEmit --incremental false
git diff --check
```

PGlite testet den Übergang von der archivierten Produktionsfassung von `20261120` und `20261121` zu `20261122` mit nachgebildeten Supabase-Rollen, Auth- und Storage-Tabellen. Die lokale Suite prüft beide Zulassungsgrenzen, FIT-Minuten, Wiederholung, Dubletten, die Adminentscheidung und die vier Divisionswechsel. Die Suite prüft Browser-RLS, das Kontolimit, die private Adminprüfung und ihre Sperre nach Widerruf, Datei-Retention und das Auffinden von Dateien nach direkter Auth-Löschung. HTTP- und Storage-Aufrufe sind lokal simuliert. Echte Garmin-Zustellung und Storage-Verhalten auf der gehosteten Instanz sind Teil der Live-Abnahme.

## Einreichung aus dem Profil

Unter „Wanderung hinzufügen“ stehen die manuelle Eintragung und der Garmin-Import zur Auswahl. „Angaben übernehmen“ öffnet das Formular für Titel, Datum, Ort und Land. Automatische OCR ist aus der Website und ihren Browser-Bundles entfernt. Der Code bleibt für spätere Anbieter erhalten. Der Klick auf „Wanderung eintragen“ legt bei aktivem `GARMIN_SUBMISSION_ENABLED` nach automatischer Prüfung einen verifizierten öffentlichen Eintrag in `records` an. Die Folgemigration `20261122_garmin_publication_rounding.sql` ersetzt die vorhandenen Publikations- und Korrekturfunktionen. Die bestehenden Beschreibungsfelder und bereits gespeicherten Beschreibungen bleiben erhalten. Eine Serverprüfung bindet den Klick an den in der Vorschau gezeigten Datenstand und prüft die aktuelle Garmin-ID und Exportberechtigung auch bei deaktivierten COMMON-Webhooks. Die Datenbank prüft Verbindung, Widerruf, Profilzuordnung und Quelldaten erneut. Ein privater Hash des Garmin-Kontos und der Aktivitäts-ID verhindert Wiederholungen auch nach einer Neuverknüpfung. Der Hash bleibt nach Trennung und Löschung eines Records erhalten. Die Aufbewahrung einschließlich des Löschkonzepts ist vor Aktivierung zu klären.

### Leistungswerte und Prüffälle

- Distanz stammt aus `distanceInMeters`, positive Höhenmeter aus `totalElevationGainInMeters` des Activities-Feeds. UHL rundet Kilometer kaufmännisch auf zwei Nachkommastellen und positive Höhenmeter auf ganze Meter. Die Zulassung prüft diese Werte auf mindestens 10,00 km oder bei kürzerer Distanz auf mindestens 600 hm. Genau diese Messwerte werden in `records` geschrieben. Rohwerte bleiben im privaten Garmin-Bestand. Null Höhenmeter sind ein gültiger Wert. Ein fehlender Aufstiegswert sperrt die Veröffentlichung. Die Datenbank bricht ab, wenn das Record-Schema Distanz, Aufstieg oder die Minutenanzeige verändern würde.
- Die FIT-freie Gesamtzeit stammt aus der konsistenten Uhrzeitdauer der Garmin-Samples in `activityDetails`. Der Prüfstatus kontrolliert Zeitfolge, Startzeit und Koordinaten und hält nur das Ergebnis fest. Für den bestehenden FIT-Pfad liefert `Session.total_elapsed_time` die Gesamtzeit inklusive Pausen. Beide Pfade schneiden Sekunden für die gespeicherte Zeit ab.
- Die lokalen Ausschlussregeln umfassen fehlende Geräteangaben, Zeit oder Aufstieg, widersprüchliche Aktivitätstypen, FIT-Parserwarnungen, mehr als 15 km/h im Schnitt und mehr als 2.000 hm pro Stunde. Automatisch zugelassen sind nur Geräteaktivitäten mit explizit negativem `manual` und `isWebUpload`. Der FIT-freie Pfad verlangt `manual: false` im Dateimetadaten-Feed. Bei unklarer Herkunft bleibt die Aktivität eine Vorschau. Der FIT-Integritätscheck und die Metadatenprüfung sind keine kryptografische Geräteattestierung.
- Nach der Veröffentlichung verwendet „Eintrag bearbeiten“ im Konto dieselbe `record_corrections`-Zeile und denselben Adminbereich wie andere Wanderungen. Die genehmigte Statusänderung und das Metadaten-Update erfolgen in einer Transaktion. Die Ablehnung lässt den Record unverändert. Distanz, Aufstieg und Zeit können weder beantragt noch am Record geändert werden.

### Tempo und Division

Der produktive Zeitparser rundet `time_hours` auf zwei Dezimalstellen. Der zusätzliche BEFORE-Trigger berechnet für neue oder leistungsseitig geänderte Garmin-Records mit `HH:MM` das Tempo aus den exakten Minuten. Der vorhandene Divisionstrigger übernimmt dieses Tempo. `time_hours`, Rundung des angezeigten Tempos und Divisionsgrenzen bleiben kompatibel. Für frühere Records gibt es keine Neuberechnung bei bloßen Metadatenänderungen. Event-Records, manuelle Records und andere Zeitformate bleiben beim bisherigen Rechenweg.

| Distanz | Zeit | Produktion | Folgemigration |
| --- | --- | --- | --- |
| 10,15 km | 02:07 | 4,79 / Silver | 4,80 / Gold |
| 10,22 km | 02:08 | 4,80 / Gold | 4,79 / Silver |
| 10,03 km | 01:44 | 5,80 / Platinum | 5,79 / Gold |
| 10,24 km | 01:46 | 5,79 / Gold | 5,80 / Platinum |

### Folgen in der UHL-Wertung

- `records` erhält den bestehenden Status `verified_admin_submission`, den unter anderem Challenges akzeptieren, und `verified = true`. Im Profil erscheint der Record zunächst öffentlich. Die vorhandene Sichtbarkeitssteuerung für freie Wanderungen bleibt verfügbar. Garmin-Dateien, Tokens, Anbieter-ID und private Inbox erscheinen nicht im öffentlichen Record.
- Die Produktion verwendet `records` für Hiker- und Site-Statistiken, `hiker_season_stats` für Saisonranglisten und Divisionen sowie vorhandene Records-Trigger für Tempo, Division und Prämienpunkte. Der Veröffentlichungsweg führt genau einen regulären Insert aus. Eine genehmigte Datumskorrektur ist ein Update und kann Saison-, Challenge- und Prämienzuordnung beeinflussen. Shopregeln und Triggerdefinitionen wurden nicht geändert. Die lokale Suite verwendet die beim Produktionsabgleich erfasste Saison-View, die Summenlogik und die Milestone-Punkteberechnung. Sie prüft 10,00 km und 600 hm in den Aggregaten und einmalig 10 Punkte. Die Korrektur über die Saisonuntergrenze verschiebt die Zuordnung ohne weitere Gutschrift. Profil-Divisionsentscheidung, produktive Sperrfunktionen und Hosted-RLS sind in dieser Aggregationsprüfung nicht abgebildet. Die Live-Gutschrift bleibt Teil der Pilotabnahme.
Lokal wurden die manuelle Nachweisauswahl, beide Rückwege, eine Ablehnung und eine bestätigte Garmin-Veröffentlichung mit simulierten API-Antworten im iPhone-Viewport (390 × 844) geprüft. Ein echtes iPhone im Home-Bildschirm-Modus bleibt Teil der Abnahme. Die alten OCR-Pfade und der OCR-Worker liefern lokal 404. Der alte Vorschauparameter zeigt die normale Kontoseite.
