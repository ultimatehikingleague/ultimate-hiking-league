# Garmin Connect – Abnahme und Freigabe

Stand 13. November 2026. Der Pilot verwendet die bestehende Supabase-Instanz. Die Produktionsdatenbank und die Garmin-Einstellungen wurden ausschließlich gelesen. Der bisherige Live-Abgleich ergab Vercel Pro mit `efc3e77` (`dpl_GcmySXaKpLxAzbj1kjK6P8T5bUSH`), zwei Shop-Crons, vorhandenen Supabase-Variablen und `CRON_SECRET`. Garmin war live deaktiviert. Vor einem Build den aktuellen Stand erneut prüfen.

## Umfang des Piloten

- Ein einziges, serverseitig konfiguriertes UHL-Konto anhand seiner Supabase-Auth-UUID. OAuth-Start, Callback, Kontozugriff, Push-Zuordnung und Worker-Claims prüfen diese Begrenzung. Fehlende oder ungültige UUID sperrt den Zugang.
- Private Importkacheln mit Garmin-Quellenhinweis. Die Browserrollen erhalten keinen Zugriff auf Importtabellen oder Rohdateien. Die Veröffentlichung ist standardmäßig gesperrt. Im lokalen Veröffentlichungspfad erzeugt erst der ausdrückliche Klick beim Hiker einen verifizierten, öffentlichen Record. Die bisherige private Prüfung betrifft ausschließlich bereits vorhandene Pilot-Einreichungen.
- UHL-Trennung wartet auf aktive Aufträge, versucht die Deregistrierung und löscht bei bestätigtem OAuth-`invalid_grant` lokal weiter. Temporäre Garmin-Fehler sind wiederholbar. Sobald die lokale Sperre gespeichert ist, bleiben weitere Importe auch bei einem Storage-Fehler gesperrt. Eine erneute Trennung setzt dann bei der Dateibereinigung fort.
- Rohdateien werden ab 24 Stunden zur Löschung fällig. Bei gelöschtem UHL-Konto entfernt die Auth-Kaskade Verbindung, Inbox und Importdaten. Der nächste Worker-Lauf findet zurückgebliebene Dateien über Storage-Metadaten, auch wenn das Konto bereits gelöscht wurde. Der Worker entfernt fällige, verwaiste oder gesperrte Rohdateien in Batches per Storage API und kann nach Fehlern erneut laufen. Die Dauer bis zur Löschung hängt von erfolgreichen Worker-Läufen ab. Normalisierte Importdaten bleiben bis zur Trennung oder Kontolöschung.
- Der bestätigte fachliche Parser für `ClientConsumerPermissions` prüft vollständige Berechtigungslisten und Zeitstempel. Unbekannte HTTP-Feeds werden vor dem Lesen des Bodys mit 404 abgewiesen. UHL verarbeitet daher im Pilot keine Garmin-seitige Deregistrierungs- oder Berechtigungszustellung automatisch.

## Lesender Abgleich mit Produktion

| Bereich | Befund |
| --- | --- |
| Migrationen | Letzter Eintrag `20261113 activity_screenshot_proofs`. Garmin-Tabellen und Garmin-Bucket fehlen. |
| Records | RLS aktiv. `SELECT` für `anon` und `authenticated` jeweils mit `true`. Null Zeilen mit `record_source = 'Garmin'` zum Prüfzeitpunkt. |
| Einreichungen | RLS aktiv. Eigentümer dürfen eigene Zeilen lesen und einfügen. Admins dürfen lesen und aktualisieren. Gesamtgröße 712 kB. |
| Aggregation | `hiker_season_stats` ist eine View über `records`. `site_stats` ist eine Tabelle. Records-Trigger aktualisieren Hiker- und Site-Statistiken und synchronisieren bzw. stornieren Prämienpunkte. Weitere Trigger berechnen Geschwindigkeit und Division. |
| Storage und Auth | `storage.objects` hat einen Schutztrigger gegen direktes Löschen. Die Garmin-Bereinigung nutzt deshalb die Storage API. In der Katalogabfrage kein nichtinterner Trigger auf `auth.users` oder `record_submissions`. |
| Backup | Jüngstes angezeigtes tägliches Backup 13.11.2026, 04:09:54 Uhr Berliner Zeit (03:09:54 UTC). Das Dashboard bestätigt die Verfügbarkeit. Datenbankbackups enthalten keine Storage-Dateiinhalte. |

[Supabase-Backups](https://supabase.com/dashboard/project/astdepkrdkmufsydxviz/database/backups/scheduled) · [Supabase-Dokumentation zu Backups](https://supabase.com/docs/guides/platform/backups)

## Garmin COMMON

Die UHL-App ist für Starter Access und die Activity API zugelassen. Garmin OAuth2 PKCE 2.0 beschreibt in Abschnitt 7 `deregistrations` mit `userId` und in Abschnitt 9 `userPermissionsChange` mit `userId`, `summaryId`, `permissions` und `changeTimeInSeconds`. Der Start Guide beschreibt HTTPS-POST mit JSON für Starter. Die Activity API 2.1 dokumentiert die Garmin-Absendernetze und für Push HTTP 200 innerhalb von 30 Sekunden sowie stündliche Wiederholung bis zu sieben Tage. [Garmin OAuth2 PKCE 2.0](https://developerportal.garmin.com/sites/default/files/OAuth2PKCE%202.0.pdf) · [Garmin Start Guide](https://developerportal.garmin.com/sites/default/files/Garmin%20Developer%20Program_Start_Guide_2.0_0.pdf) · [Activity API 2.1](https://developerportal.garmin.com/sites/default/files/Activity_API%202.1.pdf)

UHL prüft bei beiden Feeds dieselbe Garmin-IP-Liste wie für die Activity-Feeds und gleicht eine mitgesendete Garmin-Client-ID ab. HTTP 200 folgt auf die Datenbanktransaktion. Bei einem vorübergehenden Speicherfehler antwortet UHL mit 503. Die Vercel-Logs enthalten Feed, Ergebnis und Anzahl der verarbeiteten Einträge. Eine Deregistrierung enthält keinen Zeitstempel und keine Verbindungs-ID. Auch eine verspätete Zustellung kann daher eine neue Verbindung desselben Garmin-Kontos sperren. Eine erneute Berechtigungsnachricht hebt eine gespeicherte Sperre nicht auf.

Der lesende Abgleich vom 14. November zeigt in Supabase Migrationen bis `20261118_garmin_oauth_handoff`. Für den Pilot fehlen `20261119_garmin_submission`, `20261120_garmin_publication` und `20261121_garmin_common_webhooks` in dieser Reihenfolge. Vercel ordnet `www.ultimatehikingleague.com` der Produktion zu und zeigt `/api/garmin/jobs` aktiv im Minutentakt. `GARMIN_SUBMISSION_ENABLED` fehlt in den Projektvariablen. Die drei Activity-URLs standen im Garmin-Formular, alle drei Enabled-Schalter waren aus. Ob die Eingaben gespeichert sind, wurde nicht bestätigt.

## Freigaben in Reihenfolge

1. **Supabase-Migration abgeschlossen.** `20261114` bis `20261117` wurden geordnet in einer Transaktion auf dem bestehenden Projekt angewendet und im Migrationsverlauf bestätigt. Die Nachprüfung bestätigte fünf Garmin-Tabellen mit RLS, den privaten Bucket, den Quellenindex, drei Schutztrigger und den Entzug der Sequenzrechte für Browserrollen. Letztes vor dem Lauf geprüftes Backup: 13.11.2026 um 04:09:54 Uhr Berliner Zeit.
2. **Vercel-Variablen separat freigeben.** Für den deaktivierten Stand in `Production` ausschließlich `GARMIN_OAUTH_ENABLED=false`, `GARMIN_PUSH_ENABLED=false` und `GARMIN_WORKER_ENABLED=false` setzen. Der bestehende `CRON_SECRET` und die Supabase- und Shop-Konfiguration bleiben erhalten. Die Änderungen gelten erst für neue Deployments.
3. **Build und Veröffentlichung separat freigeben.** Kandidaten aus der aktuellen Live-Basis isoliert aufbauen. Die Freigabe zum Build auf Vercel von der Umschaltung der Hauptdomain trennen. Beide Shop-Crons, Shop-Variablen, Gelato-Konfiguration und Dateiliste gemäß gemeinsamem Releaseprozess abgleichen. Der lokale Zeitplan enthält zusätzlich `/api/garmin/jobs` im Minutentakt. Wird dieser Zeitplan veröffentlicht, ruft Vercel die Route mit dem bestehenden Cron-Schlüssel auf. Mit deaktiviertem Worker liefert sie 404 und greift auf keine Daten zu. Ohne gültigen Schlüssel liefert die bereitgestellte Route 401. OAuth und Activity-Push liefern 404. Shop und Admin lesend prüfen. [Gemeinsamer Produktionsrelease](production-release.md)

   Der lesende Vercel-Abgleich vom 13. November bestätigt Pro, das aktive Deployment `dpl_GcmySXaKpLxAzbj1kjK6P8T5bUSH` (`efc3e77`), beide Shop-Crons und die vorhandenen Produktionsvariablennamen im Projekt und im aktiven Deployment. Die beiden Shop-Job-Routen liefern ohne Schlüssel 401. Garmin-Callback und -Worker liefern live 404. Garmin-Variablen und Garmin-Cron sind live noch nicht eingerichtet.

4. **Garmin-Aktivierung separat freigeben.** Die drei ausstehenden Migrationen und den Build mit beiden COMMON-Empfängern auf der aktuellen Live-Basis einplanen. Garmin-Absendernetze mit `GARMIN_PUSH_IP_RANGES` und die Werte der OAuth-, Push- und Worker-Schalter im freigegebenen Produktionsstand abgleichen. Für die Veröffentlichung wird zusätzlich `GARMIN_SUBMISSION_ENABLED=true` benötigt. Nach Freigabe alle fünf Feeds im Garmin-Portal speichern und bei der ersten echten Zustellung die Logs prüfen.

   Vor der späteren Freigabe die UHL-Konto-UUID in Supabase Auth bestätigen und in `GARMIN_PILOT_USER_ID` hinterlegen. Garmin-Zugangsdaten als `GARMIN_CLIENT_ID` und `GARMIN_CLIENT_SECRET` in Vercel hinterlegen. Dazu kommen `GARMIN_REDIRECT_URI=https://www.ultimatehikingleague.com/api/garmin/callback`, ein dauerhaft aufbewahrter `GARMIN_TOKEN_KEY` aus 32 kryptografischen Zufallsbytes in Base64url und `GARMIN_PUSH_IP_RANGES` nach Abgleich mit den offiziellen Garmin-Angaben. `GARMIN_WORKER_ENABLED` separat freigeben und auf leerer Inbox mit OAuth und Push weiterhin auf `false` prüfen. Mit gültigem Cron-Schlüssel wird 200 erwartet.

   | Feed | HTTPS-Ziel auf `www.ultimatehikingleague.com` |
   | --- | --- |
   | Activities | `/api/garmin/push/activities` |
   | Activity Details | `/api/garmin/push/activityDetails` |
   | Activity Files | `/api/garmin/push/activityFiles` |
   | Deregistrations | `/api/garmin/push/deregistrations` |
   | User Permissions Change | `/api/garmin/push/userPermissionsChange` |

5. **Echten Test im eigenen UHL-Konto durchführen.** Verbinden und Activity Export zustimmen. Eine neue kurze Wanderung aufzeichnen und mit Garmin Connect synchronisieren. Push-Antwort und Worker-Verarbeitung, private Kachel, Datum, Distanz und Quellenhinweis prüfen. Mit einem zweiten Konto und anonym prüfen, dass die Aktivität über Browserzugriff, Profil, Challenge und Rangliste fehlt und öffentliche Statistikwerte unverändert sind. Anschließend in UHL trennen und fehlende Verbindung, Inbox, Kachel und Rohdateien prüfen. Direkte Kontolöschung mit synthetischem Konto lokal prüfen.
6. **Rückweg bei einem Pilotproblem.** Feeds pausieren, OAuth und Push abschalten und die gemeinsame Vercel-Rückschaltung abstimmen. Nach Eingang echter Daten den Garmin-Worker für fällige Löschungen weiter betreiben oder vor der Rückschaltung die Bereinigung kontrolliert abschließen. Tabellen und Bucket zunächst belassen. Eine Datenbank-Wiederherstellung ist ein eigener Schritt mit möglicher Downtime und Verlust späterer Änderungen.

## Lokale Prüfung

94 Tests bestanden, zwei Screenshot-OCR-Tests mangels Originaldateien und lokaler OCR-Modelle übersprungen. TypeScript und `git diff --check` sind sauber.

```sh
PGLITE_MODULE=/absoluter/pfad/zu/pglite/dist/index.js node --import tsx --test tests/*.test.*
./node_modules/.bin/tsc --noEmit --incremental false
git diff --check
```

Die Garmin-Migrationen wurden in PGlite mit nachgebildeten Supabase-Rollen, Auth- und Storage-Tabellen angewandt. Die Suite prüft Browser-RLS, das Kontolimit, die private Adminprüfung und ihre Sperre nach Widerruf, Datei-Retention und das Auffinden von Dateien nach direkter Auth-Löschung. HTTP- und Storage-Aufrufe sind lokal simuliert. Echte Garmin-Zustellung und Storage-Verhalten auf der gehosteten Instanz sind Teil der Live-Abnahme.

## Einreichung aus dem Profil

Der Einstieg „Wanderung hinzufügen“ öffnet die private Garmin-Inbox. „Angaben übernehmen“ öffnet das vorhandene Formular. Titel, Datum, Beschreibung, Ort und Land sind abänderbar. Der Klick auf „Wanderung veröffentlichen“ legt bei aktivem `GARMIN_SUBMISSION_ENABLED` nach automatischer Prüfung einen verifizierten öffentlichen Eintrag in `records` an. Die lokale Migration `20261120_garmin_publication.sql` benötigt die vorhergehenden Garmin-Migrationen. Eine Serverprüfung bindet den Klick an den in der Vorschau gezeigten Datenstand und prüft die aktuelle Garmin-ID und Exportberechtigung auch bei deaktivierten COMMON-Webhooks. Die Datenbank prüft Verbindung, Widerruf, Profilzuordnung und Quelldaten erneut. Ein privater Hash des Garmin-Kontos und der Aktivitäts-ID verhindert Wiederholungen auch nach einer Neuverknüpfung. Der Hash bleibt nach Trennung und Löschung eines Records erhalten. Die Aufbewahrung einschließlich des Löschkonzepts ist vor Aktivierung zu klären.

### Leistungswerte und Prüffälle

- Distanz stammt aus `distanceInMeters`, positive Höhenmeter aus `totalElevationGainInMeters` des Activities-Feeds. UHL rechnet Meter in Kilometer um und prüft mindestens 10 km oder bei kürzerer Distanz mindestens 600 hm auf den gespeicherten, ungerundeten Werten. Null Höhenmeter sind ein gültiger Wert. Ein fehlender Aufstiegswert sperrt die Veröffentlichung. Die Datenbank bricht ab, wenn das Record-Schema Distanz, Aufstieg oder die Minutenanzeige verändern würde.
- Die Gesamtzeit stammt aus `Session.total_elapsed_time` einer über Garmin geladenen, integren FIT-Einzelaktivität. Der Worker prüft Hersteller, Sportart, Startzeit und die Beziehung zur Timer-Zeit. Die Freigabe verwendet nur diesen expliziten Wert. Die UHL-Zeit und die daraus abgeleitete Geschwindigkeit verwenden volle, abgeschnittene Minuten. Ein echter Abgleich mit Garmin Connect steht aus. `durationInSeconds`, der höchste Sample-`clockDurationInSeconds` und aus Dateipunkten geschätzte Zeiten können diese Prüfung nicht ersetzen. [Garmin FIT Activity](https://developer.garmin.com/fit/articles/file-types/activity.html) · [Garmin FIT Elapsed und Timer Time](https://developer.garmin.com/fit/file-types/course/)
- Die lokalen Ausschlussregeln umfassen fehlende Geräteangaben, Zeit oder Aufstieg, widersprüchliche Aktivitätstypen, FIT-Parserwarnungen, mehr als 15 km/h im Schnitt und mehr als 2.000 hm pro Stunde. Automatisch zugelassen sind nur Geräteaktivitäten mit explizit negativem `manual` und `isWebUpload`. Mit Garmin klären, ob und wie diese beiden Felder im UHL-Feed bereitgestellt werden. Bei unklarer Herkunft bleibt die Aktivität eine Vorschau. Der FIT-Integritätscheck und die Metadatenprüfung sind keine kryptografische Geräteattestierung.
- Nach der Veröffentlichung verwendet „Eintrag bearbeiten“ im Konto dieselbe `record_corrections`-Zeile und denselben Adminbereich wie andere Wanderungen. Die genehmigte Statusänderung und das Metadaten-Update erfolgen in einer Transaktion. Die Ablehnung lässt den Record unverändert. Distanz, Aufstieg und Zeit können weder beantragt noch am Record geändert werden.

### Folgen in der UHL-Wertung

- `records` erhält den bestehenden Status `verified_admin_submission`, den unter anderem Challenges akzeptieren, und `verified = true`. Im Profil erscheint der Record zunächst öffentlich. Die vorhandene Sichtbarkeitssteuerung für freie Wanderungen bleibt verfügbar. Garmin-Dateien, Tokens, Anbieter-ID und private Inbox erscheinen nicht im öffentlichen Record.
- Die Produktion verwendet `records` für Hiker- und Site-Statistiken, `hiker_season_stats` für Saisonranglisten und Divisionen sowie vorhandene Records-Trigger für Tempo, Division und Prämienpunkte. Der Veröffentlichungsweg führt genau einen regulären Insert aus. Eine genehmigte Datumskorrektur ist ein Update und kann Saison-, Challenge- und Prämienzuordnung beeinflussen. Shopregeln und Triggerdefinitionen wurden nicht geändert. Die Produktionsdefinitionen und reale Aggregation müssen mit dem aktuellen Schema in einer isolierten Umgebung abgenommen werden.
- Vor der produktiven Freigabe: Migration und bestehende Trigger in einer isolierten Kopie des aktuellen Schemas testen. Eine bereinigte echte Garmin-Payload und FIT-Datei mit Pausen gegen Distanz, Aufstieg und Dauer in Garmin Connect abgleichen. Danach je einmal Klick, Wiederholung, Ablehnung und Genehmigung mit Datumswechsel testen. Profil, Speed und Division, Saisonranking, Challenge, Site-Statistik und Milestone-Stand vor und nach jeder Änderung vergleichen. Das betrifft auch Berechtigung und Datenschutz für die öffentliche Ranglisten- und Prämienwertung. Push bleibt dabei ausgeschaltet.

Der Activity-Push akzeptiert `activities`, `activityDetails` und `activityFiles`. Der HTTP-Einstieg für COMMON fehlt. Die lokale Berechtigungslogik setzt ein authentifiziertes Garmin-Ereignis voraus. Die von UHL ausgelöste Trennung ruft Garmins Deregistrierungs-API auf. Sie deckt den Empfang einer von Garmin ausgelösten Deregistrierung nicht ab. Vor Aktivierung für beide COMMON-Feeds die app-spezifische Pflicht, das Nutzlastformat, die Herkunftsprüfung und die Wiederholungsregeln bei Garmin bestätigen.
