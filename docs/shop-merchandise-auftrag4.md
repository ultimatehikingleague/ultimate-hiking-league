# Auftrag 4 – Produktverwaltung, Lager und Eigenversand

## Produktiver Ausgangspunkt

Am 7. November 2026 ausschließlich lesend in Supabase geprüft. Der Checkout-Katalog enthält als einzige aktive SKU `UHL-KAL-2027-A3`. Die alte redaktionelle Tabelle `shop_products` ist leer. Sie hat eine öffentliche Leseregel für aktive Einträge und direkte Schreibregeln für angemeldete Administratoren. Die gemeinsame Fulfillment-Ablage aus Auftrag 3 ist vorhanden.

| Baustein | Aufgabe heute |
| --- | --- |
| `app/shop/lib/products.ts` | Öffentliche Kalenderbeschreibung und Galerie. |
| `shop_catalog_products`, `app/lib/shop/catalog.ts` | Aktive SKU, Kaufpreis, Währung und Gelato-Druckkonfiguration. Die Druckfelder sind Pflichtfelder. |
| `shop_products` | Alte redaktionelle Admin-Liste, getrennt von der Verkaufskonfiguration. |
| `shop_orders`, `shop_order_lines`, `shop_payments`, `shop_invoices` | Bestell-, Zahlungs- und Rechnungsdaten. Der Kalender schreibt seinen Bestell- und Druckdatenstand zum Kaufzeitpunkt fest. |
| `shop_fulfillment` | Vorhandene Gelato-Übergabe auf Bestellungsebene. Der Zahlungstrigger stellt bezahlte Bestellungen in die Queue. Der Gelato-Aufruf prüft Freigaben und die exakte Kalender-Druckkonfiguration. |
| `shop_fulfillment_units` und zugehörige Tabellen | Gemeinsame Anzeige von Anbietern, Positionen, Paketen und Statusereignissen. Automatischer Abgleich ist auf Gelato beschränkt. |

## Lokal vorbereitet

Die geschützte Admin-Seite zeigt den bestehenden Checkout-Katalog lesend und verwaltet neue Artikel separat. Produktname, Beschreibung, SKU bei Anlage, optionaler EUR-Preis, Kategorie, Kollektion, Produktwelt, Status, Fulfillment und bis zu zwölf HTTPS-Bildadressen sind hinterlegt. Die SKU bleibt als fachlicher Schlüssel fest. Das Schema hat eine optionale Eltern-SKU für spätere Varianten. Die Variantenauswahl und die Zuordnung von Elternprodukten folgen mit dem Katalog.

`UHL-PATCH-001` ist als Eigenversand-Entwurf in der Produktwelt ULTIMATE HIKING LEAGUE mit einer nachvollziehbaren Eröffnungsbuchung über 98 Stück vorbereitet. Preis, Fotos, Beschreibung und Versandkonditionen bleiben bis zur Festlegung offen. Alle Statuswerte sind intern. Die öffentliche Galerie und der bestehende Kaufpfad lesen weiterhin aus ihren bisherigen Quellen.

Die Migration legt zwei private Tabellen an. `shop_merchandise` speichert Redaktion und Lagerzähler. `shop_inventory_entries` speichert Korrekturen mit Grund und Admin-ID sowie Reservierungen mit Referenz auf die Bestellposition und Abschlusszeitpunkt. Beide Tabellen haben RLS und keine Zugriffe für anonyme oder normal authentifizierte Clients. Die Shop-API verifiziert das Benutzertoken und die Admin-Mitgliedschaft auf dem Server. Schreibaufrufe erfordern denselben Origin. Metadatenänderungen verwenden eine Versionskennung. Bestandskorrekturen verwenden eine eindeutige Buchungs-ID und sperren die Produktzeile. Das Protokoll wird nur auf Abruf gelesen.

| Vorgang | Regel |
| --- | --- |
| Verfügbarkeit | Physischer Bestand abzüglich reservierter Stückzahl. Verkaufte Stücke werden separat gezählt. |
| Reservierung | Nur für ausstehende LIVE-Bestellungen mit passender aktiver Eigenversand-SKU und passendem Positionspreis. Bestell- und Produktzeile werden gesperrt. Jede Position hat höchstens einen Eintrag. |
| Verkauf | Benötigt eine gespeicherte, zur Bestellung passende Zahlung. Zieht Bestand und Reservierung ab, erhöht verkauft und legt in derselben Transaktion eine Eigenversandeinheit mit verknüpfter Position an. |
| Freigabe | Erst bei einem endgültig fehlgeschlagenen Bestellstatus mit dokumentierter Anbieterreferenz. Der derzeitige Statuskatalog hat keinen separaten Stornostatus. Bei der späteren Anbindung muss ein bestätigter endgültiger Abbruch konsistent auf `failed` abgebildet werden. Browser-Abbruch und Zeitablauf allein geben keinen Bestand frei. Erstattete Verkäufe führen nicht automatisch zu einer Einlagerung. |
| Versand | Administrator bestätigt die tatsächliche Übergabe, mit Versanddienstleister und optionaler Trackingnummer und HTTPS-Link. Die Zustellung wird separat bestätigt. Beides erzeugt je ein dedupliziertes Ereignis mit Admin-ID. Eigenversand ist in der bestehenden Bestelldetailansicht sichtbar. |
| Pakete und Anbieter | Der vorbereitete Eigenversand verwendet eine Einheit und ein Paket je verkaufter Eigenversandposition. Eine Bestellung kann mehrere Einheiten und zugleich Gelato enthalten. Verpackung mehrerer Positionen in einem gemeinsamen Paket folgt bei Bedarf. |

Die vier neuen Datenbankfunktionen sind serverintern. Reservierung und Abschluss sind noch nicht an Kauf, Webhooks oder Jobs angeschlossen. Es gibt keine neue Abfrage im öffentlichen Shop und kein Polling. Ein Verkauf von Patches ist in diesem Schritt technisch nicht erreichbar.

## Freigaben und weiterer Ablauf

1. **Geschützte Admin-Verwaltung.** Nach separater Freigabe die produktiven Abhängigkeiten und den Wiederherstellungsweg prüfen. Ausschließlich die additive Migration `20261107_shop_merchandise.sql` einzeln einspielen und die Zugriffsrechte, die Entwurfszeile und den Eröffnungsbestand kontrollieren. Danach die Admin-Version bereitstellen. Die Admin-Version kann unabhängig zurückgerollt werden. Soll das Schema zurückgenommen werden, vorher vorhandene neue Artikel und Lagerbuchungen exportieren und abhängige Eigenversandeinheiten separat behandeln. Den Kalender anschließend mit einem lesenden Smoke-Test prüfen.
2. **Katalog vereinheitlichen.** Zuerst nach SKU zwischen Redaktion und kaufbarer Konfiguration unterscheiden und das öffentliche Angebot über eine explizite Freigabe steuern. Den Kalender im Schattenvergleich prüfen, insbesondere Preis, Währung, Galerie, Länder, Druckdatei und Versand. Alte Quellen erst nach erfolgreichem Vergleich umschalten. Redaktion und kaufbare Fulfillment-Konfiguration können über eine gemeinsame Katalogabfrage zusammengeführt werden, während Bestell- und Druckdatenstände unverändert bleiben.
3. **Kauf und Fulfillment nach gesonderter Freigabe.** Die Bestellposition muss ihre Fulfillment-Art beim Kauf festschreiben. Der heutige Gelato-Queue-Trigger reagiert auf jede bezahlte Bestellung und muss vor dem Patch-Checkout durch eine positionsbezogene, explizite Routingregel abgesichert werden. Nur freigegebene Gelato-Positionen dürfen in die Gelato-Aufgabe, mit einer zusätzlichen Prüfung im Worker vor dem API-Aufruf. Eigenversand-Reservierungen müssen vor Erstellen der externen Zahlung atomar erfolgreich sein. Mehrere Artikel in stabiler SKU-Reihenfolge sperren. Bei Stripe und PayPal endgültige Abbrüche und asynchrone bzw. verspätete Zahlungsereignisse gemeinsam prüfen. Im Sandbox-Test zwei unabhängige Datenbankverbindungen verwenden, Teilfehler und Webhook-Wiederholungen nachstellen sowie gemischte, reine Eigenversand- und reine Gelato-Bestellungen prüfen. Die aktuelle Bestell- und Rechnungslogik geht von einer Checkout-Konfiguration pro Bestellung aus und braucht für gemischte Warenkörbe einen eigenen fachlichen Vergleich.
4. **Drop nach gesonderter Freigabe.** Verkaufspreis, Fotos, Versandgebiete, Versandkosten, Verpackung und die initiale Inventur bestätigen. Erst dann den Patch und die gemeinsame Shop-Oberfläche freigeben.

## Verifikation

- 42 automatisierte Tests bestanden, einschließlich isolierter PostgreSQL-Tests für den Ausgangsbestand, die Rechte, konkurrierende Reservierungsversuche, Zahlungsnachweis, terminale Freigabe und getrennte Versand- und Zustellbestätigung. Der Test hat vorhandene Kalender-, Bestell-, Zahlungs-, Rechnungs- und Queue-Datensätze vor und nach der Migration verglichen.
- TypeScript, ESLint für die geänderten Dateien und isolierter Next.js-Produktionsbuild bestanden. Der repositoryweite ESLint-Lauf meldet 71 Fehler und 42 Warnungen in anderen Dateien.
- Der SQL-Test verwendet eine eingebettete PostgreSQL-Instanz. Ein Mehrverbindungstest mit realem Zahlungsablauf ist Teil der gesonderten Checkout-Phase.
- Für Auftrag 4 wurden keine produktiven Migrationen, Deployments oder Testkäufe ausgeführt.

## Produktiver Rollout am 7. November 2026

- Vorprüfung um 11:30 MEZ. Die beiden neuen Tabellen und vier Funktionsnamen waren frei. Aktive SKU war ausschließlich der Kalender. Das physische Supabase-Backup `2189876876` vom selben Tag um 04:09:26 MEZ war abgeschlossen. PITR war deaktiviert. Ein vollständiger Restore auf diesen Stand könnte spätere Transaktionen zurücksetzen. Der bevorzugte Anwendungsrückweg ist das vorherige Vercel-Deployment `dpl_DDeaB7swu9QzzCqMfmmZFfWyEUpF`. Die zwei additiven Tabellen können bei einem Anwendungsrollback bestehen bleiben.
- In Produktion wurde ausschließlich `20261107_shop_merchandise.sql` als SQL-Einzeldatei ausgeführt und bis 11:31:34 MEZ verifiziert. SHA-256 `700ee937f0bf4015df5382b942b049a2c5ab869ddafe493be2a64f58428238a5`. RLS war auf beiden Tabellen aktiv. Die Serverrolle hatte Zugriff auf beide Tabellen und alle vier Funktionen. Die Rollen `anon` und `authenticated` hatten keinen direkten Tabellen- oder Funktionszugriff.
- `UHL-PATCH-001` war danach als Entwurf ohne Preis mit 98 verfügbaren, 0 reservierten und 0 verkauften Stück vorhanden. Das Journal enthält eine Eröffnungsbuchung über 98. Die Produkt- und Journalabfragen wurden über die produktive REST-Schnittstelle mit Serverrolle geprüft. Ein anonymer Direktzugriff wurde abgewiesen.
- Vercel-Deployment `dpl_6nk3NVgZJ5HAqsacSJbxFXoZEHDx` wurde nach Build, Dateivergleich und Kandidatenprüfung auf die Hauptdomain geschaltet. Von 166 Laufzeitdateien änderten sich genau sieben im Admin-Umfang. Der automatisch angelegte Vercel-Zugang für den Kandidatentest wurde widerrufen. Die bestehenden Jobs bleiben minütlich beziehungsweise viertelstündlich konfiguriert. Es gibt keinen neuen Zeitplan. [Dateivergleich](shop-merchandise-release-scope.json)
- Nach der Umschaltung wurden Produktanlage, Bearbeitung mit Versionskennung, Bestandskorrektur, Wiederholschutz und Lagerjournal als Serverrolle in einer Produktions-SQL-Transaktion geprüft. Der Rollback entfernte sämtliche Testdaten. Danach waren weiterhin genau ein Merchandise-Produkt und seine Eröffnungsbuchung gespeichert. Ein angemeldeter Browser-Durchlauf war nicht möglich. Die Admin-Seiten antworteten mit HTTP 200, die Datenendpunkte wiesen anonyme Anfragen mit 403 ab.
- Die Kalenderseite und der aktive Checkout antworteten mit HTTP 200. Ein echtes Gelato-Versandangebot für den Kalender lieferte einen Versandweg und den unveränderten Artikelpreis von 29,90 EUR. Die Patch-Seite antwortete mit 404. Die Patch-SKU wurde von der bestehenden Angebots-API mit 503 und der Meldung „Dieser Artikel ist derzeit nicht bestellbar“ abgewiesen. Stripe und PayPal wiesen unsignierte Webhooks mit 400 ab. Die Bestände in den Shop-Tabellen blieben bei sieben Bestellungen, sieben Bestellpositionen, vier Zahlungen, zwei Rechnungen und zwei Gelato-Fulfillment-Zeilen. Es wurde kein Kauf, keine Zahlung, keine Rechnung und kein Gelato-Auftrag ausgelöst.
