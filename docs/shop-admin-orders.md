# Lesende Shop-Bestellverwaltung

Stand: 06.11.2026. Keine Migration, keine Änderung an Verkaufsabläufen, keine Veröffentlichung neuer Produkte.

## Einstieg und Dateien

- `/admin/shop`: vorhandene Bestellungen-Kachel verlinkt jetzt zur Bestellverwaltung (`app/admin/shop/page.tsx`).
- `/admin/shop/orders`: Bestellliste, Pagination (25), Zahlungsstatus-/Test-Live-/Datumsfilter und Detailansicht (`app/admin/shop/orders/page.tsx`).
- `GET /api/admin/shop/orders`: ausschließlich lesende Admin-Schnittstelle (`app/api/admin/shop/orders/route.ts`).
- `app/lib/shop/admin-orders.ts`: explizite Feldlisten, Filtervalidierung und Datenabfragen.
- `tests/admin-orders.test.mts`: Autorisierung, Filter, Datenabrufe und Original-PDF-Download.

Jeder API-Aufruf prüft den Bearer-Token serverseitig über den bestehenden `requireShopAdmin`-Helfer (auth.getUser + admin_users), bevor der Service-Zugriff auf Bestelldaten erfolgt. Der Browser erhält niemals den Service-Schlüssel. Die Seite selbst ist eine leere Client-Oberfläche bis zum autorisierten Datenabruf; Sicherheit hängt nicht von versteckten UI-Elementen ab. Antworten sind privat/no-store. POST/PATCH/DELETE sind nicht implementiert.

## Daten

Vorhandene Tabellen: shop_orders, shop_order_lines, shop_payments, shop_fulfillment, shop_invoices. Keine neuen Tabellen/Felder oder RPCs.

Die Liste enthält nur Kundenname und Bestellinformationen, keine vollständige Adresse. Details enthalten Liefer-/Kontaktdaten, Positionen, Preise, Zahlungsreferenzen, Rechnungsmetadaten und Gelato-Auftrags-ID. Tokenhashes, Checkout-URLs und PDF-Inhalte werden nicht mit Listen oder Details übertragen. Der gesonderte autorisierte Download liest ausschließlich pdf_base64 des vorhandenen Originals; er ruft keine Rechnungserstellung auf.

Datumfilter beziehen sich auf created_at und Berliner Kalendertage, einschließlich des gewählten Enddatums. Kein Zahlungsdatumfilter. TEST/LIVE bleiben eindeutig markiert. pending bedeutet Zahlung ausstehend, nicht automatisch einen offenen Produktionsauftrag.

Gelato submitted und completed_at bezeichnen ausschließlich eine abgeschlossene Auftragsübergabe. Es werden keine Versand-/Zustellzustände daraus abgeleitet. Keine Übergabe kann auch bedeuten, dass noch keine Zahlung bestätigt wurde.

## Spätere Erweiterung (nicht implementiert)

Bestellpositionen, Zahlungen, Rechnungen und Fulfillment werden in getrennten DTO-Bereichen geführt; Fulfillment ist bereits als Liste modelliert. Die aktuelle Tabelle shop_fulfillment erlaubt jedoch nur eine Zeile pro Bestellung. Die Darstellung allein ermöglicht daher noch keine gemischten Sendungen.

Für Eigenversand und mehrere Partner ist später nach Rücksprache ein zusätzliches Sendungs-/Fulfillment-Modell mit Zuordnung zu Positionen und Teilmengen erforderlich. Darin Partner bzw. Eigenlager, Bearbeitung, Versanddienstleister, Trackingnummer und Versanddatum separat vom Zahlungsstatus führen. Gelato-Meldungen und manuelle Eigenversandaktionen sollen dasselbe Sendungsmodell bedienen. Bestehende Gelato-Übergabedatensätze weiterverwenden oder kontrolliert zuordnen, keine Doppelproduktion.

Der Patch und der genannte Bestand von 98 Stück werden durch diese Änderung weder angelegt noch freigeschaltet. Auch manuelle Statusänderungen, Bestandspflege, Versandaktionen und Erstattungen sind nicht enthalten.

## Prüfung

- `node --import tsx --test tests/admin-orders.test.mts`
- `npx eslint app/admin/shop/orders/page.tsx app/api/admin/shop/orders/route.ts app/lib/shop/admin-orders.ts`
- `npx tsc --noEmit`
- `npm run build`

Die API-Tests simulieren Datenbankantworten und prüfen, dass alle Datenbank-/Auth-Abfragen GET verwenden; es werden keine echten Bestellungen erzeugt oder geändert. Kein Produktions-Deployment Bestandteil dieser Änderung.

## Entwicklungsauftrag 2: Kennzahlen und Kaufversuche (06.11.2026)

Geänderte/ergänzte Dateien:
- app/admin/shop/page.tsx: echte Kennzahlen über serverseitig geschützte API; Grenzen und Live-Testkäufe sichtbar erläutert.
- app/admin/shop/orders/page.tsx: bezahlt als Standard, separater Zugang zu unbezahlten Kaufversuchen, keine erfundene Ablauf-/Abbruchkennzeichnung.
- app/lib/shop/admin-orders.ts: Standardfilter paid; bei paid zusätzlicher INNER-Join auf vorhandene shop_payments.
- app/lib/shop/admin-metrics.ts (neu): paginierte lesende Aggregation bestätigter LIVE-Zahlungen, Berliner Zahlungsdatum.
- app/api/admin/shop/metrics/route.ts (neu): GET, serverseitige Admin-Prüfung vor Datenabruf, private/no-store.
- tests/admin-metrics.test.mts (neu): Berechnungen, Zeitgrenzen, Ausschlüsse, Autorisierung, Pagination und Lesefehler.
- tests/admin-orders.test.mts: weiterhin verwendete Zugriffs-/Filter-/Downloadtests.
- docs/shop-admin-orders.md: diese Dokumentation.

Berechnung:
- Bestellungen heute: bestätigter Zahlungsdatensatz in mode=live, verknüpfte Bestellung ebenfalls live und status=paid, paid_at innerhalb des heutigen Berliner Kalendertags. Bestellerstellungsdatum ist dafür nicht maßgeblich.
- Umsatz gesamt: Summe amount_cents dieser bestätigten, weiterhin bezahlten LIVE-Bestellungen, einschließlich Kunden-Versandbetrag, ohne Abzug von Anbieter-/Produktionskosten. Bekannte refunded-Status werden ausgeschlossen. Keine Aussage über steuerlich bereinigten Umsatz oder Zahlungsanbieter-Auszahlungen.
- Offene Bestellungen: null / „Nicht ermittelbar“. Das bestehende Schema besitzt keinen Versandabschluss; submitted oder completed_at dürfen nicht als Zustellung gelten.
- Übergangszahl: bestätigte bezahlte LIVE-Bestellungen ohne Fulfillment oder mit einem Übergabestatus ungleich submitted. Diese Zahl ist nur ein Hinweis auf ausstehende/prüfbedürftige Übergaben, keine Gesamtzahl offener Lieferungen.
- API-Fehler führen zu Fehlermeldung und fehlenden Zahlen, niemals zu erfundenen Nullen. Supabase-Ergebnisse werden in Seiten zu 500 Zahlungen vollständig gelesen; es gibt keinen stillen 1000-Datensätze-Abbruch.

Abgrenzungen:
- pending: unbezahlt oder noch laufende Zahlung; kein Beweis eines Kaufabbruchs. Der Filter „Unbezahlte Kaufversuche“ zeigt pending. failed ist separat auswählbar; das System stellt Checkout-Ablauf und endgültigen Abbruch bisher nicht selbst zuverlässig fest.
- Standard bezahlt umfasst TEST und LIVE (Badge bleibt sichtbar), ausschließlich mit Zahlungsdatensatz. Alle Datensätze und einzelne Zustände bleiben auswählbar. Keine Datensatzänderung.
- Rückerstattungen/Teilrückzahlungen/Stornierungen werden nicht vollständig synchronisiert; unbekannte Änderungen beim Zahlungsanbieter können hier nicht bereinigt werden. Keine automatische Neuabfrage von Zahlungsanbietern oder Änderung ihrer Webhooks.
- LIVE ist eine Zahlungsumgebung. Alle vorhandenen Live-Testzahlungen bleiben unverändert und in den finanziellen Live-Summen enthalten. Es gibt aktuell kein zuverlässiges Kennzeichen interner Tests.

Vorschlag für spätere interne Testkennzeichnung — Freigabe erforderlich, NICHT umgesetzt:
Separate Tabelle shop_order_annotations mit order_id (FK/PK), purpose ('customer'|'internal_test'|'unclassified'), reason, classified_by, classified_at; dazu unveränderliches Änderungsprotokoll und serverseitig autorisierte Pflege. Bestandsdaten zunächst unclassified, niemals anhand Name, E-Mail oder Zahlungsumgebung automatisch umklassifizieren. Reguläre Kaufkennzahlen erst nach bewusster Klassifikation separat auswerten. Finanzielle Zahlungssummen müssen echte Live-Testzahlungen trotzdem weiterhin nachvollziehbar ausweisen; Rechnungen und Zahlungen bleiben unverändert. Dies erfordert eine ausdrücklich freigegebene Migration und einen späteren eigenen Verwaltungsauftrag.

Prüfung Auftrag 2: node --import tsx --test tests/admin-orders.test.mts tests/admin-metrics.test.mts; gezieltes ESLint; TypeScript; Produktions-Build. Zusätzlich neue Abfragen einmal ausschließlich lesend gegen Supabase geprüft (nur Summen ausgegeben). Keine Migration, kein Deployment, keine Checkout-/Payment-/Fulfillment-/Rechnungsänderung.
