# Milestone-Shop: Backstage bereit – 5. November 2026

Live-Verwaltung: https://www.ultimatehikingleague.com/admin/milestone-shop
Geschützte Vorschau: https://www.ultimatehikingleague.com/admin/milestone-shop/vorschau
Deployment: dpl_9qa6nVHy1kCGfmUJkCyWoo1JNZgJ

## Bedienung

1. Mit dem bestehenden Admin-Konto anmelden und die Milestone-Verwaltung öffnen.
2. Angebote mit Titel, Partner, Beschreibung, Kosten, einer Logo-URL und Einlösehinweisen anlegen. Neue Angebote sind inaktiv.
3. Für Gutscheine und Rabatte Codes als CSV/Text importieren oder zeilenweise einfügen. Der Bestand wird aus den verfügbaren und vergebenen Codes ermittelt. Vergeben bedeutet Zuteilung an einen Hiker, nicht nachgewiesener Kauf beim Partner.
4. Darstellung in der geschützten Vorschau kontrollieren. Dort werden auch inaktive Entwürfe angezeigt; Einlösen ist deaktiviert.
5. Fertige Angebote aktivieren. Solange der globale Status geschlossen ist, bleiben sie trotzdem unveröffentlicht.
6. Erst zum tatsächlichen Start „Launch vorbereiten“ und anschließend „Jetzt öffentlich freigeben“ wählen. Dies öffnet Shop, Einlösung und Guthabenanzeige gemeinsam. Der Shop lässt sich im selben Bereich wieder schließen.

## Aktueller Status

Der globale Datenbankstatus is_live bleibt false. Öffentliche Shopseiten und die persönliche Prämienseite liefern 404, Guthaben und Shoplinks im Account sind ausgeblendet. Die bestehenden Datenbankfunktionen haben zusätzlich eine Freigabesperre. Die Verwaltung und Vorschau erfordern ein vorhandenes admin_users-Konto; Daten bleiben durch RLS geschützt. Der Outdoor Store und Kalender wurden nicht umgeschaltet.

## Grenzen vor dem Launch

Die vorhandene Einlösung unterstützt derzeit Gutscheine und Rabattcodes. Physische Produkte können als Entwurf gepflegt werden; ihre Einlösung und Versandabwicklung sind noch nicht implementiert. Eine kostenlose Affiliate-Rubrik ist ebenfalls noch nicht enthalten. Diese Punkte benötigen eine eigene Umsetzung, bevor entsprechende Angebote veröffentlicht werden.

Es wurden keine unbestätigten Partnerangebote oder echten Partnercodes angelegt. Die beiden vorhandenen Testangebote sind weiterhin inaktiv.

## Geprüft

- TypeScript-Prüfung und Produktionsbuild erfolgreich.
- Datenbank: fünf Originalfunktionen gesichert und mit Freigabesperren versehen.
- Normaler authentifizierter Nutzer kann nicht freigeben, einlösen oder Katalogdaten lesen.
- Admin-Freigabe und erneutes Schließen in einer zurückgerollten Transaktion getestet; öffentlicher Status blieb false.
- Live-Admin, Codebestand und geschützte Vorschau mit dem vorhandenen Admin-Konto geladen.
- Öffentliche Milestone-Seiten 404; bestehender Outdoor Store und Kalender 200.
