# Gemeinsamer Produktionsrelease für ULTIMATE

1. Das Deployment der Hauptdomain ermitteln und seinen vollständigen Quellstand sichern. Mit dem integrierten Hauptbranch vergleichen. Abweichungen fachlich klären, bevor ein neuer Kandidat gebaut wird. Die beiden Shops, Garmin, Partnerverwaltung und Liga teilen sich dasselbe Vercel-Projekt.
2. Den Kandidaten isoliert erstellen. Die vollständige Liste gewünschter Änderungen vorab prüfen, einschließlich gelöschter Dateien und Konfiguration. Die Liste aus dem fachlich geprüften Umfang ableiten.
3. Alle Releaseprüfungen ausführen. Dafür sind Node.js, die installierten Anwendungsabhängigkeiten, Playwright mit Chromium und ein isoliertes PGlite erforderlich. Der Nachweis gehört außerhalb des Quellordners.

   ```sh
   PGLITE_MODULE=/absoluter/pfad/zu/pglite/dist/index.js      node scripts/check-release.mjs LIVE_DEPLOYMENT_ID /absoluter/pfad/release-proof.json
   ```

   Die Prüfung umfasst Unit- und PostgreSQL-Tests, einen frischen Next.js-Produktionsbuild und Browsertests mit synthetischen Daten. Der Nachweis enthält die Prüfsumme jeder getesteten Quelldatei und die ID der erwarteten Live-Basis.
4. Nur nach Freigabe den getesteten Stand als Vercel-Produktionskandidaten ohne Domainwechsel bauen. Den vollständigen Upload und das resultierende Deployment prüfen.

   ```sh
   UHL_RELEASE_PROOF=/absoluter/pfad/release-proof.json      node scripts/verify-production-release.mjs LIVE_DEPLOYMENT_ID KANDIDAT_DEPLOYMENT_ID        app/beispiel.tsx
   ```

   Der Dateivergleich stoppt bei unbeabsichtigten Änderungen, fehlenden Manifestdaten, Abweichungen vom getesteten Quellstand und einer inzwischen geänderten Hauptdomain. Vercel-Metadaten erlauben zusätzlich den Vergleich von Build-Einstellungen, Regionen und Variablennamen. Die tatsächlichen Konfigurationswerte müssen vor der Umschaltung separat überprüft werden. Für den wiederhergestellten Sprachstand müssen `UHL_WAVE1_RELEASE_BUILD`, `NEXT_PUBLIC_UHL_WAVE1`, `NEXT_PUBLIC_UHL_PL`, `NEXT_PUBLIC_UHL_IT`, `NEXT_PUBLIC_UHL_ES` und `NEXT_PUBLIC_UHL_CS` beim Produktionsbuild auf `1` stehen. `SHOP_STATUS_SYNC_ENABLED=true` bleibt bestehen. Die drei bestehenden Cronpfade und ihre Zeitpläne prüfen.
5. Pro Projekt eine verantwortliche Person für die Umschaltung bestimmen. Direkt vor der Umschaltung erneut die Domainzuordnung prüfen. Danach öffentliche Routen, authentifizierte Profile und Adminfunktionen lesend prüfen. Bei einem Rückwechsel den zuvor bestätigten Live-Stand samt Einstellungen verwenden. Eine separate Produktionsfreigabe ist Voraussetzung für jede Umschaltung.
6. Den geprüften vollständigen Quellstand im Hauptbranch verankern. Automatische Produktions-Deployments und die Rechte zur Domainumschaltung so konfigurieren, dass ungeprüfte Git-Stände den gemeinsamen Releaseprozess nicht umgehen können.

## Ursache des Release-Konflikts vom 8. November 2026

Der parallel veröffentlichte Milestone-Release `dpl_6MvMCSiPk2fPu2XrS3gwS5VfNWYm` übernahm den Live-Quellstand und änderte zwei Milestone-Admin-Dateien. Seine Datei-Prüfung berücksichtigte die Vercel-Umgebungsvariablen nicht. Der Gelato-Schalter existierte damals nur am vorherigen Deployment und fehlte deshalb am Milestone-Release, obwohl der Zeitplan erhalten blieb. Der gemeinsame Versandrelease `dpl_8nmvcpirVNtNqiEZHq5Mha9f5oYR` übernahm beide Milestone-Dateien bytegenau und stellte den Gelato-Schalter wieder her. Anschließend wurde derselbe Wert auf Projektebene ausschließlich für Production hinterlegt.
