# Gemeinsamer Produktionsrelease für ULTIMATE

Der Milestone Shop und der ULTIMATE OUTDOOR STORE haben getrennte Kataloge, Geschäftsregeln, Einlöse- beziehungsweise Bestellprozesse, Zahlungen und Fulfillment. Supabase, Anmeldung, neutrale UI-Komponenten und das Vercel-Projekt können gemeinsam genutzt werden. Jede Änderung bleibt im fachlich zuständigen Bereich.

## Gemeinsamer Release-Stand

1. Vor dem Build das Deployment der Hauptdomain `www.ultimatehikingleague.com` ermitteln. Dies ist der Basisstand für beide Shops. Einen isolierten Kandidaten aus genau diesem Stand zusammenstellen und nur die ausdrücklich vorgesehenen Änderungen auflegen. Ein lokaler Arbeitsstand kann unveröffentlichte Änderungen enthalten.
2. Den Kandidaten mit Produktionskonfiguration und ohne Umschaltung der Hauptdomain bauen. Der Gelato-Statusschalter `SHOP_STATUS_SYNC_ENABLED=true` ist in Vercel für **Production** hinterlegt. Er gehört zum Outdoor Store und bleibt bei Milestone-Releases erhalten.
3. Vor einer freigegebenen Umschaltung den Kandidaten testen und die gemeinsame Prüfung ausführen. Die Dateiliste muss den genehmigten Änderungen entsprechen.

   ```sh
   node scripts/verify-production-release.mjs LIVE_DEPLOYMENT_ID KANDIDAT_DEPLOYMENT_ID \
     app/admin/shop/shipping/page.tsx
   ```

   Die Prüfung vergleicht die tatsächliche Hauptdomain, alle hochgeladenen Quelldateien und die verfügbaren Namen der Produktionsvariablen. Sie stoppt bei einem verschobenen Basisstand, fremden Dateiänderungen oder fehlender Produktionskonfiguration. Vercel liefert hier die Namen der Variablen. Geplante Änderungen an ihren Werten brauchen eine eigene Konfigurationsprüfung.
4. Pro Vercel-Projekt darf nur eine Person oder Aufgabe gleichzeitig die Produktionsdomain umschalten. Direkt nach erfolgreicher Prüfung umschalten und die neue Zuordnung sowie die betroffenen Funktionen prüfen. Falls inzwischen ein anderer Release live ist, die fremden Änderungen in den Kandidaten übernehmen, neu bauen und erneut prüfen. Die Vercel-Umschaltung ist technisch vom Prüfbefehl getrennt.
5. Beim Rückweg ebenso beide Shops und die Produktionskonfiguration prüfen. Ein historisches Deployment kann ältere Umgebungswerte enthalten. Eine Rückschaltung auf ein Deployment ohne Gelato-Schalter würde den Abgleich erneut stoppen.

## Ursache des Release-Konflikts vom 8. November 2026

Der parallel veröffentlichte Milestone-Release `dpl_6MvMCSiPk2fPu2XrS3gwS5VfNWYm` übernahm den Live-Quellstand und änderte zwei Milestone-Admin-Dateien. Seine Datei-Prüfung berücksichtigte die Vercel-Umgebungsvariablen nicht. Der Gelato-Schalter existierte damals nur am vorherigen Deployment und fehlte deshalb am Milestone-Release, obwohl der Zeitplan erhalten blieb. Der gemeinsame Versandrelease `dpl_8nmvcpirVNtNqiEZHq5Mha9f5oYR` übernahm beide Milestone-Dateien bytegenau und stellte den Gelato-Schalter wieder her. Anschließend wurde derselbe Wert auf Projektebene ausschließlich für Production hinterlegt.
