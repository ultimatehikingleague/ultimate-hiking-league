# Shop-Verkaufsstart – Stand 04.11.2026

## Verifiziert
- Vercel-Team auf Pro umgestellt und über API bestätigt.
- Live-Zugang Stripe (eingeschränkter Schlüssel): Checkout-Session-Lesezugriff HTTP 200. Erstellen einer Live-Session noch nicht geprüft.
- PayPal Live OAuth HTTP 200. Händler-ID noch gegen eine echte Zahlung zu prüfen.
- PayPal Live Webhook für www.ultimatehikingleague.com/api/shop/paypal/webhook angelegt; zwei Ereignisse.
- Stripe Live Webhook im Dashboard vom Inhaber angelegt, whsec geschützt hinterlegt. Zustellung noch nicht geprüft.
- Server-Einstellungen verschlüsselt im bestehenden Vercel-Projekt, nur Production. SHOP_CHECKOUT_ENABLED, SHOP_LIVE_APPROVED und SHOP_FULFILLMENT_ENABLED bleiben false.
- SQL-Katalog/Rechnungen und Hosted-Fulfillment laut Inhaber erfolgreich ausgeführt.
- Rechnung für bestehende bezahlte Testbestellung generiert und visuell geprüft. Wiederabruf ergibt identische Nummer und PDF.
- TypeScript und Produktions-Build erfolgreich. Zahlungs-/Entwurfstests bestanden; neuer Live-Produktions-Gate-Test bestanden.

## Implementiert und auf der Domain bereitgestellt
- /api/shop/jobs mit CRON_SECRET-Prüfung; Vercel-Zeitplan jede Minute.
- Dauerhafte Warteschlange, exklusive Claims, Unterbrechungen nach zehn Minuten in manuelle Prüfung.
- Tests erzeugen ausschließlich Entwürfe. Produktion benötigt zwei ausdrückliche Flags und bezahlte Live-Bestellung.
- Produktion verwendet freigegebene Kalenderdatei; weitere Artikel benötigen eigene Druckdateiprüfung im Übergabecode.
- Geschützter Rechnungsdownload auf Bestellbestätigungsseite, Nummernkreise getrennt nach Test/Live.

## Vor Freischaltung weiterhin erforderlich
1. Vertragsbestätigung mit Rechnungsanhang implementiert; Versand bleibt bis zur abschließenden Prüfung deaktiviert.
2. Widerrufsbelehrung, Musterformular, zweistufige elektronische Erklärung und dauerhafte Speicherung implementiert. SQL-Erweiterung vom Inhaber erfolgreich ausgeführt und Schema per API geprüft. Datenschutz/Impressum ergänzt. Vollständige rechtliche Prüfung nicht zugesagt.
3. Produkt-/Verpackungs-/Lieferlandinformationen insbesondere CH prüfen.
4. Produktionsdeployment erfolgt. Domain: Widerruf/Bestellinformationen HTTP 200, Checkout geschlossen, unberechtigter Job-Aufruf 401, authentifizierter Job-Aufruf 200 mit notificationsOk=true. Signierte tatsächliche Live-Ereigniszustellung noch zu prüfen.
5. Mit eingeschränktem Stripe-Live-Schlüssel Session-Erstellung prüfen; ggf. gezielte Zusatzrechte statt Vollzugriff.
6. Gehosteten Ablauf zunächst geschlossen testen. Keine alte Testbestellung als Produktionsauftrag auslösen.
7. Erst nach abgeschlossenen Prüfungen Verkauf und Fulfillment freischalten.

Keine Zugangsdaten in dieser Datei. Lokale Testumgebung unverändert. Gewerbeanmeldung laut Inhaber abgeschlossen. Persönliche Steuer-ID wird nicht verwendet.

## Letzte Prüfung
- 15 Zahlungs-/Fulfillment-Schutztests bestanden; TypeScript und Produktionsbuild bestanden.
- Ungültige PayPal-Anfragen ohne Signatur werden vor einem Anbieteraufruf mit 400 abgewiesen.
- Benachrichtigungsfehler blockieren keine Fulfillment-Verarbeitung.
- SHOP_CONFIRMATIONS_ENABLED zusätzlich als false auf Production hinterlegt.
- Widerrufs-E-Mail-Wiederholungen sind auf 23 Stunden begrenzt (Anbieter-Idempotenz 24 Stunden); danach manuelle Prüfung erforderlich. Begonnene uneindeutige Bestellbestätigungen werden nicht automatisch erneut versandt.

## Freischaltung 05.11.2026
Inhaber hat ausdrücklich den sofortigen Verkaufsstart einschließlich automatischer Gelato-Produktion freigegeben; echter Testkauf folgt im laufenden Betrieb.
- Stripe-Live-Checkout erstellt: 2990 + 574 = 3564 Cent, unpaid; anschließend sofort abgelaufen. Keine Abbuchung.
- PayPal-Live-Vorgang erfolgreich erstellt, Händlerzuordnung korrekt, 35.64 EUR; unbestätigt, kein Capture ausgelöst.
- Resend-Domain mail.ultimatehikingleague.com per API als verified bestätigt.
- Production: SHOP_PAYMENT_MODE=live; CHECKOUT_ENABLED, LIVE_APPROVED, CONFIRMATIONS_ENABLED, FULFILLMENT_ENABLED=true.
- Deployment dpl_2bwzAjt53gbrRji67nsYVTjhPnvk.
- Vollständige echte Zahlung mit anschließendem Rechnungsversand und Gelato-Produktionsauftrag noch nicht durchgeführt.
- Verpackung: Gelato erklärt Deckung der über seine Plattform produzierten/verpackten/versandten Bestellungen inkl. Landbell/LUCID: https://support.gelato.com/de/articles/8996179-verpackungsgesetz-und-lucid-id . Keine pauschale Übertragung auf andere Lieferanten oder eigenen Versand.
