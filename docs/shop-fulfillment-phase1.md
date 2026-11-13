# Auftrag 3: Analyse und Freigabevorlage

Stand: 06.11.2026. Phase 1 abgeschlossen; keine produktiven Änderungen, keine externe Konfiguration, keine Statussynchronisation implementiert.

## Befund im bestehenden System

- `app/lib/shop/fulfillment.ts`: bezahlte Aufträge werden beansprucht, anhand ihrer Referenz gesucht und gegebenenfalls erstellt. `submitted` bedeutet erfolgreiche Übergabe, `completed_at` das Ende dieser Übergabe — weder Versand noch Zustellung.
- `app/lib/shop/gelato-draft.ts`: vorhandener API-Client, Produkt-/Druckdateiprüfung und Referenzen `ultimate-live-<UUID>` bzw. `ultimate-test-<UUID>`. TEST verwendet Gelato-Entwürfe im selben Gelato-Konto. Nicht mit einer getrennten Gelato-Testumgebung verwechseln.
- `app/api/shop/jobs/route.ts`, `vercel.json`: bestehende Hintergrundverarbeitung. Diese bleibt unangetastet; Statusabgleich bekommt später eine eigene Route.
- `app/lib/shop/admin-orders.ts`, `app/api/admin/shop/orders/route.ts`, `app/admin/shop/orders/page.tsx`: lesende Bestellverwaltung und Detailanzeige.
- `app/lib/requireShopAdmin.ts`: serverseitige Administratorprüfung, auch für spätere manuelle Abgleichanforderungen wiederverwenden.
- `app/lib/shop/admin-metrics.ts`: offene Bestellungen absichtlich unbekannt; Übergabe ist kein Versandnachweis.

Tatsächlich vorhandene Tabellen: `shop_orders`, `shop_payments`, `shop_order_lines`, `shop_fulfillment`, `shop_invoices`, `shop_catalog_products`, `shop_shipping_regions`, `shop_withdrawals`. `shop_fulfillment` hat genau einen Datensatz pro Bestellung, unter anderem `mode`, `status`, `gelato_order_id`, `attempts`, `last_error`, `completed_at`. Das reicht nicht für mehrere Partner/Pakete. `shop_order_lines` enthält keine Anbieterzuordnung. `shop_withdrawals.contract_reference` ist Text, keine belastbare Artikel-/Erstattungszuordnung.

Read-only-Prüfung: Supabase-Schema gelesen, eine vorhandene LIVE-Gelato-Verknüpfung gefunden und den bestehenden Auftrag per GET erfolgreich gelesen (HTTP 200). Status `in_production`; ein Paket mit Trackingdaten existiert bereits. Keine Bestellung erzeugt, verändert oder storniert. Keine Zugangsdaten oder Kundendaten in diesen Bericht übernommen.

## Dokumentierte Gelato-Möglichkeiten

[Order GET v4](https://dashboard.gelato.com/docs/orders/v4/get/): Auftrag und Artikel liefern `fulfillmentStatus`, Pakete liefern `trackingCode`, `trackingUrl` und `orderItemIds`. `connectedOrderIds` verweist auf verbundene Aufträge. Die dokumentierten Versandmethoden sind keine separate, garantiert normierte Carrier-ID. `financialStatus` betrifft Gelato und ersetzt niemals unseren Kundenzahlungsstatus. Tatsächliche Versand-/Zustellzeitpunkte sind dort nicht als verlässliche Felder dokumentiert; sie bleiben unbekannt, solange kein unterstützter Nachweis vorliegt.

[Auftragsmodell](https://dashboard.gelato.com/docs/orders/order_details/): dokumentiert unter anderem `in_production`, `printed`, `shipped`, `in_transit`, `delivered`, `returned`, `failed`, `canceled`, `on_hold`. Aufträge können mehrere Pakete oder verbundene Aufträge haben. Produktions-, Transport- und Zustellinformationen kommen somit teilweise aus demselben Statusfeld, nicht aus drei unabhängigen Status-APIs.

[Webhooks](https://dashboard.gelato.com/docs/webhooks/): Status- und Trackingereignisse für Auftrag/Artikel vorhanden. HTTPS-Empfang und 2xx-Antwort erforderlich; dokumentierte Wiederholungen sind begrenzt. Keine belastbare HMAC-Signaturprüfung in der geprüften Dokumentation beschrieben. Deshalb Webhooks zunächst nur als Hinweis auf einen authentifizierten GET verwenden, nicht als alleinigen Statusnachweis. Optionale Lieferprognose-Ereignisse sind Beta; nicht erforderlich.

[Ordersuche v4](https://dashboard.gelato.com/docs/orders/v4/search/): Suche nach Referenz/IDs ermöglicht spätere lesende Wiederzuordnung. Keine Erstellung hierfür nötig. [Webhook-Einrichtung](https://support.gelato.com/en/articles/8996576-how-do-i-configure-notifications-webhooks) erfolgt gesondert im Dashboard, erst nach Freigabe.

## Gemeinsames Datenmodell

SQL-Entwurf: `docs/sql/20261106_fulfillment_tracking.draft.sql`, bewusst außerhalb automatisch ausgeführter Migrationen.

1. `shop_fulfillment_units`: mehrere Anbieteraufträge pro Shop-Bestellung, externe Referenz, Rohstatus und getrennte vorsichtige Statusprojektion. Eigener Versand nutzt später Anbieter `manual`; keine Produktfreischaltung.
2. `shop_fulfillment_unit_lines`: Zuordnung von Bestellpositionen/Teilmengen zum Anbieterauftrag. Anbieterartikel-IDs gelten nur innerhalb der Einheit.
3. `shop_fulfillment_shipments`: mehrere Pakete pro Einheit, Tracking und nullable tatsächliche Zeitpunkte. Beobachtungszeitpunkte bleiben ausdrücklich separat.
4. `shop_fulfillment_shipment_lines`: Artikelzuordnung je Paket; Menge darf unbekannt sein, da Gelato-Artikelreferenzen allein keine Teilmenge beweisen.
5. `shop_fulfillment_sync`: dauerhafte Warteschlange mit Lease, Fehler, Versuchen und letztem erfolgreichen Abruf.
6. `shop_fulfillment_events`: deduplizierbare technische Ereignisse ohne vollständige Kunden-/API-Rohdaten.

Keine Änderung bestehender Tabellen, Trigger, RPCs oder Bestellungen. Fremdschlüssel sichern die Zugehörigkeit neuer Positionen/Pakete zur Bestellung. Bestehende Übergabetabelle bleibt allein für Produktionsübergabe zuständig. Neue Tabellen sind RLS-geschützt und ausschließlich serverseitig erreichbar.

## Umsetzung nach Freigabe

1. SQL zunächst separat prüfen/anwenden; produktive Ausführung nur ausdrücklich freigegeben. Vorher Zustand sichern und neue Tabellen auf Namenskonflikte prüfen. Kein automatischer Backfill in der Migration.
2. Dedizierten GET-only-Gelato-Statusclient bauen. Bestehenden Erstellungsclient nicht für Statusarbeit verwenden. Vorhandene `gelato_order_id` plus exakte Referenz und TEST/LIVE prüfen. Verbundene IDs nur mit gleicher Referenz übernehmen; Zyklen, Anzahl und Abrufdauer begrenzen. Unklare Artikelzuordnung als Prüfbedarf behandeln.
3. Rückwirkende Aufnahme vorhandener Verknüpfungen idempotent. Positionen nur bei eindeutig passender SKU/Produktkennung/Menge zuordnen. Keine Wiederholung der Produktionsübergabe.
4. Eigener Hintergrundjob zunächst etwa alle fünf Minuten, begrenzte Anzahl, Timeout, Backoff und 429-Behandlung. Lease und atomare Übernahme verhindern parallele Anwendung veralteter Antworten. Ereignis-ID/Hash verhindern Doppeleinträge. Transaktionale Schreibfunktion und deren Rechte vor produktiver Nutzung zusätzlich prüfen. Unbekannte API-Statuswerte unverändert speichern und sichtbar als unbekannt kennzeichnen.
5. Erfolgreiche Abrufe aktualisieren Status und `last_success_at`; Fehler überschreiben keine zuletzt bekannten Fakten. Versand-/Zustellzeiten niemals aus Abrufzeit, Lieferprognose oder allgemeinem `updatedAt` erfinden. `printed` nur als „Gedruckt“, nicht automatisch „Versandbereit“. Paketstatus nicht aus einem unklar aggregierten Gesamtstatus ableiten.
6. Admin zeigt Zahlung, Übergabe, Produktion und Transport getrennt, inklusive Quellen-/Aktualitätshinweis und mehrerer Pakete. Trackinglinks nur HTTPS/HTTP mit sicherem externen Link. Manuelles Aktualisieren: serverautorisierter, gegen Cross-Site-Aufrufe geschützter POST mit Rate-Limit, der nur Statusarbeit einreiht.
7. Webhooks optional nachgelagert: eigene URL, minimierte Nutzdaten, bestehende Referenzen prüfen, Rate-Limit und GET-Verifikation; Polling bleibt Ausfallsicherung. Keine Änderung an Stripe-/PayPal-Webhooks.
8. Tests: Statusmatrix, Tracking vor Versand, Splitorders, Teilpakete, unbekannte Werte, TEST/LIVE, doppelte/verspätete Ereignisse, Lease/Retry, API-Ausfall, Admin-Abweisung und Ausschluss aller Create-/Cancel-/Refund-Aufrufe. Danach TypeScript, ESLint, Produktions-Build und Regressionstests.

Zugang: vorhandener Gelato-Schlüssel reicht für geprüften GET. Keine neuen Schlüssel für den ersten Polling-Ausbau nötig. Später braucht es einen separaten geschützten Job-Endpunkt mit Hosting-Zeitplan; optional zusätzliche Gelato-Webhook-Konfiguration. Beides erst nach Freigabe. Keine Behauptung einer garantierten minutengenauen Zustellung: Verfügbarkeit und Granularität hängen von Gelatos tatsächlichen Angaben ab.

## Rückabwicklung, Bestand und interne Tests: nächste Schemafreigabe

Diese Teile werden jetzt nicht aktiviert und sind nicht Bestandteil des beigefügten Kern-SQL. Vor ihrer Umsetzung folgt ein eigener SQL-Entwurf:

- Rückabwicklungsfälle mit Typ Widerruf/Mangel/Teilwiderruf/Stornierung, Bestell- und Positionsbezug, Mengen, Bearbeitungsstatus und separatem Partner-Stornierungsergebnis. Eine Erstattung ist niemals Nachweis einer Produktionsstornierung.
- Erstattungsjournal mit Anbieter-/Transaktionsreferenz und eindeutigem Ereignisschlüssel, bestätigtem Betrag in Cent, Währung, Status und Zeit. Aufteilungen auf Warenpositionen, erstattungspflichtige ursprüngliche Standardlieferkosten und Zusatzversand getrennt. Rücksendekosten separat; keine pauschale Verrechnung. Bereits erstattete Beträge und Mengen begrenzen weitere Erstattungen transaktional. Keine automatischen Zahlungsaktionen.
- Bestandsjournal je SKU mit Reservierung, Versandabgang, Freigabe und geprüfter Rücknahme. Eindeutiger Vorgangsbezug verhindert doppelte Buchung. Eine Zahlungserstattung allein erhöht keinen Bestand. Die genannten 98 Patches werden erst nach Bestandsprüfung als Eröffnungsbuchung erfasst; aktuell keine Buchung/Veröffentlichung.
- Interne LIVE-Testkennzeichnung als separate auditierte Annotation (unclassified/customer/internal_test), ohne Zahlungen, Rechnungen oder vergangene Bestellungen umzuschreiben. Bestehende Käufe bleiben unverändert.
- Finanzberichte zeigen bestätigte LIVE-Einnahmen einschließlich transparentem Versand, bestätigte Erstattungen und verbleibende Einnahmen getrennt; interne Tests separat ausweisbar. Gelato-Rechnungen sind Aufwendungen, kein Kundenzahlungsstatus und kein Umsatzabzug in dieser Statusintegration.

## Freigabeumfang und Risiken

Erbeten: Freigabe des additiven Kernschemas sowie der anschließenden Polling-/Admin-Implementierung. Produktive SQL-Ausführung und externe Konfiguration bleiben separate Schritte. Neue Tabellen allein ändern keinen Verkauf. Risiken der Umsetzung sind falsch zugeordnete Split-Aufträge, nicht verfügbare Detailzeitpunkte, veraltete Antworten und API-Ausfälle; die oben beschriebenen Prüfungen und die Anzeige „unbekannt“ sind verpflichtend. Die bestehende Kennzahl offener Bestellungen bleibt bis zu einer geprüften, vollständigen Statusabdeckung unbekannt.
