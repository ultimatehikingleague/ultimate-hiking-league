# Kalendergalerie und Gelato-Status am 07.11.2026

Die [Kalenderseite](https://www.ultimatehikingleague.com/shop/schorschys-wanderkalender-2027) zeigt Cover, Januar, August und Dezember 2027. Die Produktgalerie und die öffentliche Katalogstruktur verwenden dieselbe Liste in `app/shop/lib/products.ts`. Die zweite geänderte Laufzeitdatei ist `app/shop/schorschys-wanderkalender-2027/page.tsx`. Die Prüfung am veröffentlichten Deployment öffnete auf 1.440 und 390 CSS-Pixeln alle vier Motive im Modal und bestätigte den Umlauf zum Cover sowie den Bestelllink.

| Vorschau | Geprüfte Datei | Seite im Druckexport |
|---|---|---:|
| Cover | cover-final.webp | 1 |
| Januar 2027 | month-1-final.webp | 2 |
| August 2027 | month-8-final.webp | 9 |
| Dezember 2027 | month-12-final.webp | 13 |

Die Monatsüberschriften auf den Bildern stimmen mit dem Exportmanifest und dem Kontaktbogen überein. Die Produktions-PDF hat 14 Seiten. Cover und zwölf Monatsseiten sind in der Datei enthalten. Ihr SHA-256 stimmt mit dem freigegebenen Export überein (`d42ee835e4e82f5fb05f02073583f7f1aa4f8e7cc4ca6ee2f12ddb88707656c8`). Die übrigen WebP-Dateien liegen weiterhin im Projekt und bleiben über ihre direkten Asset-URLs erreichbar. Die öffentlichen Galeriefunktionen führen ausschließlich die vier ausgewählten Bilder.

Veröffentlichtes Galerie-Deployment `dpl_Auc4qeJosz7EUacguaENH4MUKyni`, Basis `dpl_6oA29jwa7ai8usbTHKDbYQBJh3vF`. Der Hashvergleich umfasst 153 Laufzeitdateien und weist ausschließlich die zwei genannten Änderungen aus. Er schließt Checkout, Zahlungsanbieter, Versand, Rechnungsbackup und die zuvor veröffentlichten Performance-Dateien ein. [Releaseumfang](calendar-gallery-release-scope.json)

## Gelato-Stand vor Aktivierung

Der Gelato-Adapter hat die bestehende LIVE-Bestellung anhand von Auftrags-ID, eigener Referenz und LIVE-Typ geprüft. Der aktuelle Anbieterstatus am 07.11.2026 gegen 10:49 MEZ war `in_transit` (**Unterwegs**), mit einem Paket und Trackingdaten. Produktion und Zustellung werden für diesen Snapshot als unbekannt ausgewiesen. Dies ist ein lesender Gelato-Befund. Der gezielte Produktionsabgleich und der veröffentlichte Admin-Zugang sind weiter unten dokumentiert. [Gelato Get Order](https://dashboard.gelato.com/docs/orders/v4/get/)

Die Produktionsbasis ergab sieben Shop-Bestellungen, vier Zahlungsdatensätze, zwei Rechnungen und zwei Fulfillment-Zeilen. Begrenzte GETs auf die geplanten Trackingtabellen ergaben HTTP 404/PGRST205. HEAD war für diesen Nachweis ungeeignet. Diese Werte wurden vor dem Rollout über die angemeldete Supabase-CLI bestätigt.

## Geprüfter Gelato-Release

Die vorbereitete Migration `supabase/migrations/20261106_fulfillment_tracking.sql` legt sieben neue Tabellen an. Sie trennen Anbieteraufträge, Artikelzuordnungen, Pakete, Paketpositionen, Abgleichwarteschlange, Ereignisse und den Suchcursor. Die Rechte auf die neuen Tabellen und RPCs sind auf den bestehenden Serverdienst begrenzt. Bestehende Shop-Tabellen werden nur für Fremdschlüssel und gezielte Abfragen herangezogen. Die Migration läuft in einer Transaktion mit 1 s Sperr- und 15 s Statement-Zeitlimit.

Der isolierte Anwendungsrelease enthält den Link zur bereits vorbereiteten Bestellverwaltung, deren Admin-API und Trackingansicht, den Gelato-GET-Adapter, Statusworker, Linkprüfung und den geschützten Cronpfad. Er setzt auf dem Galerie-Deployment auf. Der bisherige minütliche Shop-Cron bleibt als unabhängiger Verkaufspfad erhalten. Die manuelle Aktualisierung ist auf den ausgewählten LIVE-Auftrag begrenzt und arbeitet im selben Claim-/Lease-Verfahren.

| Geplanter Betrieb | Abfrageverhalten |
|---|---|
| Cron alle 15 Minuten | Ein Claim-Aufruf bei leerer Warteschlange, null Gelato-GETs |
| Suche nach neuen Übergaben | Maximal 64 Primärschlüssel je Durchlauf, bei vollständiger Seite Fortsetzung nach 15 Minuten, nach Rundlauf Neustart nach einer Stunde |
| Produktion und andere aktive Zustände | Nächster Abruf frühestens nach 15 Minuten |
| Versendet oder unterwegs | Nächster Abruf frühestens nach 6 Stunden |
| Zugestellt, storniert oder zurückgesandt | Automatischer Abruf endet für diese Einheit |
| Anbieterfehler | Backoff ab 2 Minuten bis 1 Stunde, tatsächlicher Abruf im 15-Minuten-Raster. Nach acht Fehlern oder Referenzkonflikt manuelle Prüfung |
| Manuell | Bis zu drei Einheiten der ausgewählten Bestellung, mindestens 60 Sekunden Abstand zum letzten Versuch je Einheit |

Ein Claim sperrt eine Einheit für zwei Minuten. Abgelaufene Tokens können keinen Status schreiben. Bereits bekannte Splitaufträge werden beim Abruf ihres Elternauftrags nicht erneut zur Identitätsprüfung geladen. Neue Splitreferenzen werden über Gelato-GET geprüft. Pakettracking bleibt von Versand- und Zustellnachweisen getrennt. Bei gewöhnlichem Leerlauf ergibt die Planung 96 kleine Datenbank-Claims pro Tag, ohne externe GETs. Eine unterwegs befindliche Einheit verursacht im Normalfall höchstens vier geplante Gelato-GETs pro Tag. Die beobachtete Last des ersten geplanten Laufs steht im Rollout-Protokoll.

40 Tests bestanden, einschließlich isolierter PostgreSQL-Migration, Lease- und Statusregression, PayPal-/Stripe-Schutztests und manueller Rechnungssicherung. TypeScript und beide isolierten Produktions-Builds bestanden. ESLint meldete null Fehler und zwei vorhandene Bildhinweise auf der Produktseite.

## Rückweg und Aktivierungsreihenfolge

Zuerst ein vorhandenes physisches Backup des konkreten Projekts bestätigen. Die lesende SQL-Vorabfrage prüft die bisherigen Shop-Zähler und Namenskonflikte. Bei Konflikten die Migration unterbrechen. Danach ausschließlich die genannte SQL-Datei ausführen. Der SQL-Entwurf im Dokumentationsordner ist keine zweite Migration. Ein Fehler in der Transaktion rollt die neuen Objekte zurück. Für die Rückkehr der Anwendung dient das Galerie-Deployment, damit Galerie, Rechnungssicherung und Performance-Releases weiter verfügbar bleiben. Neue Trackingdaten bei einem Anwendungsrollback erhalten. Eine vollständige Wiederherstellung der aktiven Datenbank bedarf wegen zwischenzeitlicher Käufe einer eigenen Prüfung. [Supabase-Backups](https://supabase.com/docs/guides/platform/backups)

Nach bestätigter Migration zuerst den bekannten LIVE-Auftrag gezielt über die neue Warteschlange abgleichen, Anzeige und gespeicherten Status vergleichen und die Shop-Zähler kontrollieren. Erst danach den geschützten 15-Minuten-Cron mit explizitem Aktivierungsschalter veröffentlichen. Die tatsächlichen zusätzlichen Claims, Anbieter-GETs und Supabase-Zähler vor und nach dem Start vergleichen. 

## Rollout-Protokoll

- **Wiederherstellungspunkt:** physisches Supabase-Backup `2189876876`, abgeschlossen am 07.11.2026 um 04:09:26 MEZ. Point-in-Time Recovery war nicht aktiv. Der Anwendungsrückweg ist die Rückschaltung auf das Galerie-Deployment. Eine Datenbankwiederherstellung auf den Backupzeitpunkt kann jüngere Käufe zurücksetzen und bedarf einer eigenen Prüfung.
- **Ausgeführte Migration:** ausschließlich `supabase/migrations/20261106_fulfillment_tracking.sql`. Die Vorprüfung ergab keine vorhandenen Trackingtabellen oder Namenskonflikte. Nach der Migration ist RLS auf allen sieben neuen Tabellen aktiv. Den Claim kann nur die Serverrolle ausführen.
- **Bekannte LIVE-Bestellung:** gezielt als **Unterwegs** gespeichert (`in_transit`), ein Paket mit Trackingdaten. Produktion und Zustellung stehen auf **Unbekannt**. Die Datenabfrage der Admin-Ansicht wurde mit dem produktiven Datensatz geprüft. Der gezielte Worker benötigte drei Supabase-Aufrufe und genau einen Gelato-GET. Die separate manuelle Produktionsprüfung im Leerlauf ergab einen Claim und keinen Gelato-GET.
- **Veröffentlichter Statusrelease:** `dpl_DDeaB7swu9QzzCqMfmmZFfWyEUpF`. Der Vercel-Schalter `SHOP_STATUS_SYNC_ENABLED=true` gilt für dieses Deployment. Die Bestellverwaltung ist unter `/admin/shop/orders` erreichbar. Beide Cron-Zeitpläne wurden in den Vercel-Projektdaten geprüft. [Geprüfter Releaseumfang](gelato-status-release-scope.json)
- **Produktionsprüfung:** Checkout, Startseite, Bildressource und Admin-Seiten antworteten mit HTTP 200. Die drei Admin-Endpunkte verweigerten anonyme Anfragen mit 403. Beide Cron-Endpunkte antworteten ohne Schlüssel mit 401. Die authentifizierte Browseransicht konnte ich nicht öffnen. Die im Admin verwendete Datenabfrage und die Zugriffssperren wurden direkt geprüft. Es wurden keine Käufe, Zahlungen, Rechnungen oder Produktionsaufträge ausgelöst.

- **Erster automatischer Lauf:** am 07.11.2026 um 11:00:30 MEZ mit HTTP 200 im Vercel-Protokoll. Die PostgreSQL-Statistik stieg um einen Claim mit **2,901 ms** zusätzlicher SQL-Ausführungszeit. Apply-Aufrufe, Statuseinträge und letzter Abrufzeitpunkt blieben gleich. Damit gab es in diesem Lauf keinen Anbieterabruf. Der Vergleich vor und nach dem Lauf ergab weiterhin sieben Bestellungen, vier Zahlungsdatensätze, zwei Rechnungen und zwei Fulfillment-Zeilen. Die Messung belegt den Leerlauf eines produktiven Laufs. Sie umfasst keinen Langzeitverlauf oder laufenden Bestand mit mehreren fälligen Aufträgen.

## Auftrag 4 vorgemerkt

Die 98 vorhandenen ULTIMATE HIKING LEAGUE Aufnäh-Patches bilden den nächsten Auftrag. Der spätere Umfang umfasst Produktverwaltung, Lagerbestand und Bestandsabbuchung, Eigenversand, manuelle Versandbestätigung mit Versanddienstleister und Trackingnummer sowie gemeinsame Bestellverwaltung für mehrere Anbieter. Diese Vormerkung schaltet kein weiteres Produkt frei.
