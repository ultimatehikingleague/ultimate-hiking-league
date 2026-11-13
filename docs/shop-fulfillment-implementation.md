# Auftrag 3 – lokale Implementierung

Stand 06.11.2026. Schema-/Umsetzungsfreigabe erteilt. Keine produktive Migration, kein Deployment, keine externe Konfiguration vorgenommen.

## Implementiert

- Separater Gelato-v4-GET-Client mit Referenz-/TEST-/LIVE-Prüfung, begrenzten Antworten, Zeitlimit und minimiertem Datensnapshot. Kein Create-, Cancel-, Refund- oder Zahlungsaufruf.
- Eigene Statuswarteschlange: transaktionale Claims, zweiminütige Lease, atomare Übernahme mit Tokenprüfung, Wiederholung mit Backoff, Prüfstatus nach wiederholten Fehlern. Zuletzt erfolgreiche Fakten bleiben bei Fehlern erhalten.
- Bereits vorhandene Gelato-IDs werden idempotent in die neue Struktur übernommen. Verbundene Aufträge werden vor Speicherung authentifiziert gelesen und auf dieselbe Referenz geprüft. Höchstens 20 Einheiten pro Shop-Bestellung, begrenzte Arbeitsmenge pro Aufruf. Eigene Artikel-/Paketzuordnung; unklare Aufteilungen erscheinen als Prüfbedarf.
- Mehrere Pakete und Anbieteraufträge, sichere Trackinglinks; Gesamtstatus wird nicht ungeprüft auf einzelne Pakete übertragen. Carrier und Versandmethode sind getrennt. Versand-/Zustellzeitpunkte bleiben unbekannt, soweit kein dokumentierter Nachweis vorliegt.
- Admin-Detailanzeige mit separaten Produktions-, Transport- und Zustellinformationen, Rohstatus, Aktualität und Abruffehlern. Geschützter manueller Abgleich reiht Arbeit ein; ein Hintergrundlauf übernimmt sie. „Anzeige aktualisieren“ liest nur die Datenbank.
- Neuer Cronpfad alle fünf Minuten; standardmäßig durch `SHOP_STATUS_SYNC_ENABLED` deaktiviert. Bestehender Produktionsjob bleibt unverändert.
- Keine neuen Produkte, Bestandsbuchungen, Erstattungen, Stornierungen, Änderungen an Widerrufstexten oder Umsatzberechnungen. Rückabwicklungs-/Bestands-/Testkaufkonzept weiterhin in `shop-fulfillment-phase1.md`.

## Geänderte/neue Dateien dieses Auftrags

- `app/lib/shop/gelato-status.ts` – nur lesender Anbieteradapter und Statusprojektion.
- `app/lib/shop/tracking-url.ts` – gemeinsame sichere Linkprüfung, enthält keine Zugangsdaten/API-Aufrufe.
- `app/lib/shop/status-sync.ts` – Hintergrundverarbeitung und lesender Adminabruf.
- `app/api/shop/status-jobs/route.ts` – separater Cron-Endpunkt mit Secretprüfung und Aktivierungsschalter.
- `app/api/admin/shop/tracking/route.ts` – serverseitig autorisierter GET und gleichursprünglicher POST; manuelle Anforderung zeitlich begrenzt.
- `app/admin/shop/orders/Tracking.tsx` – neue Detailkomponente.
- `app/admin/shop/orders/page.tsx` – Einbindung der Komponente und korrigierter Hinweistext.
- `vercel.json` – zusätzlicher, separater Zeitplan. Bestehender Zeitplan unverändert.
- `supabase/migrations/20261106_fulfillment_tracking.sql` – freigegebene additive Tabellen plus neue Seed-/Claim-/Refresh-/Apply-/Link-Funktionen. Nur neue Trackingtabellen werden beschrieben; bestehende Zahlungs-/Produktionsfunktionen unverändert.
- `tests/gelato-status.test.mts`, `tests/fulfillment-tracking-sql.test.mts` – neue Tests.
- `docs/shop-fulfillment-implementation.md` – dieses Protokoll.

Der ursprüngliche SQL-Entwurf unter `docs/sql/` bleibt als Prüfungsvorlage erhalten. **Nicht beide SQL-Dateien ausführen**; die vollständige Migration unter `supabase/migrations/` ist die anwendbare Fassung.

## Prüfung

- TypeScript erfolgreich.
- ESLint für alle in diesem Auftrag geänderten TypeScript-Dateien erfolgreich.
- Produktions-Build erfolgreich. Bereits vorhandener Hinweis zur veralteten Next.js-Middleware-Konvention; keine Änderung hieran.
- 28 automatisierte Tests einschließlich bestehender Admin-/Kennzahlen-, Zahlungs- und Produktionsregression sowie isoliertem PostgreSQL-Migrationstest erfolgreich.
- SQL-Test verwendet PGlite in `/tmp/ultimate-status-sql-test`, niemals produktive Supabase-Daten. Prüft Migration, Rechte, Idempotenz, Paket-/Artikelzuordnung, Tracking vor Versand, Fehlererhalt, abgelaufene Claims und Splitaufträge.

Reproduktion:

```
PGLITE_MODULE=/tmp/ultimate-status-sql-test/node_modules/@electric-sql/pglite/dist/index.js node --import tsx --test tests/*.test.mts tests/fulfillment.test.ts tests/shop-payments.test.ts
npx tsc --noEmit
npm run build
```

Ohne den optionalen `PGLITE_MODULE` wird ausschließlich der isolierte SQL-Test übersprungen. Keine Projektabhängigkeit wurde hinzugefügt. Kein visueller Browser-Abnahmetest und kein produktiver schreibender Synchronisationslauf durchgeführt. Der neue GET-Adapter wurde zusätzlich an bestehenden Referenzen geprüft: LIVE erfolgreich mit Status `shipped`, einem Paket und Trackingdaten; ältere TEST-Referenz HTTP 404. Es wurden hierbei keine Daten verändert.

## Produktive Aktivierung – noch ausstehend

1. Vollständige Migration `supabase/migrations/20261106_fulfillment_tracking.sql` im Supabase SQL Editor einmalig in einer Transaktion anwenden. Bestehende Tabellen/Datensätze werden nicht verändert. Vorher Backup/Namenskonflikte prüfen. Kein SQL-Abruf mit Kunden-/Zahlungsdaten nötig.
2. Anwendung bereitstellen. Vorhandene Gelato-/Supabase-/Cron-Zugangsdaten weiterverwenden; keine Schlüssel im Browser hinterlegen. Die bestehende Produktion bleibt vom neuen Aktivierungsschalter unabhängig.
3. Erst nach erfolgreicher Migration `SHOP_STATUS_SYNC_ENABLED=true` für die gewünschte Serverumgebung setzen und neu bereitstellen. Cron-Konfiguration wird erst durch Deployment aktiv.
4. Erste vorhandene Bestellung in Admin öffnen und Abgleich anfordern. Nach nächstem Cronlauf Anzeige aktualisieren, Referenz/Status/Pakete prüfen. Keine Testproduktion bestellen.
5. Fehler bei Abfrage lassen sich durch `SHOP_STATUS_SYNC_ENABLED=false` stoppen; ursprünglicher Produktionsjob arbeitet weiter. Neue Tabellen nicht löschen, da dort Prüfhistorie liegt.

Offene Grenzen: Keine Webhook-Einrichtung erforderlich; Polling ist der gewählte Startweg. Liefer-/Versandzeitpunkte können unbekannt bleiben. „Offene Bestellungen“ auf dem Dashboard bleibt bis zu vollständiger und geprüfter Statusabdeckung unbekannt; es wird weiterhin keine falsche Zahl angezeigt. Unklare Split-Artikelmengen werden nicht geraten. Das gesamte vorhandene Arbeitsverzeichnis enthält weitere, ältere Änderungen; ein späteres Deployment muss diese separat prüfen, insbesondere den verborgenen Milestone-Bereich.
