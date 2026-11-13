# Performance-Vorbereitung – 06.11.2026

> Historischer Vorbereitungsstand vor der erweiterten Freigabe. Umsetzung und aktuelle Produktionsstände: [Abschlussbericht](performance-implementation-20261106.md).

## Freigabegrenze und Arbeitsstand

Nur lokale Vorbereitung. Keine Datenbankabfragen gegen Produktion, SQL-Ausführung, Migration, Flags, LaunchAgent-Änderungen, Cron-Aufrufe oder Deployments. Kein Commit/Push. Der Arbeitsbaum enthält umfangreiche vorhandene Änderungen; diese bleiben unangetastet. Checkout, Rechnungserstellung, Bestätigungen und Kalenderproduktion werden nicht verändert. Gelato-Statusabgleich bleibt nicht aktiviert.

Wichtig: `scripts/sync-shop-invoices.mjs` wird laut tatsächlich gelesener LaunchAgent-Datei direkt alle 300 Sekunden ausgeführt (RunAtLoad zusätzlich). Daher bleibt dieses Skript unverändert. Der neue Kandidat `scripts/candidates/incremental-invoice-backup.mjs` hat bewusst weder CLI-Einstieg noch Zugangsdatenlader. Er ist nicht eingeschaltet.

## Verifizierte Pfade und Sicherheitsgrenzen

- Startseite: `app/page.tsx` verwendet force-dynamic und den gemeinsamen anon-Supabase-Client. Challenge → Teilnehmer → aktive Hiker bilden eine abhängige Kette; daneben Site-Stats, globale Top 10, drei unlimitierte Divisionsabfragen, optional Saisonwerte, Events, Partnerbuchungen und Records → Hiker/Events. Überwiegend sequenzielle awaits. Die Divisionslisten werden bei Saisonranking erst lokal umsortiert: ein vorschnelles limit(10) nach Lebenszeitkilometern würde falsche Saisonranglisten erzeugen.
- `records` liest acht Zeilen nach activity_date absteigend, ohne expliziten record_status-Filter. Ob dies öffentlich korrekt ist, muss anhand produktiver RLS und Fachregeln geklärt werden, bevor Daten gemeinsam gecacht werden.
- `app/lib/supabase.ts`: gemeinsamer Client mit anon-Schlüssel; keine explizite serverseitige Cache-Grenze in diesen Pfaden. Nicht pauschal die gesamte Startseite cachen. Öffentliche Loader später mit eigenem zustandslosem anon-Client, expliziten Feldern und geprüfter RLS isolieren. Keine Sessions, Auth-Header, Admin-, Bestell- oder Rechnungsdaten in einen gemeinsamen Cache übernehmen. Fehler nicht als leere erfolgreiche Ranglisten dauerhaft cachen. Sperrung/Privatisierung von Profilen braucht definierte Invalidierung bzw. kurze akzeptierte TTL.
- Backup: bisher seitenweise `number,pdf_base64`, mode=live; vorhandene PDFs werden jedes Mal erneut übertragen. Kandidat liest nur number per Keyset-Pagination, danach gezielt einzelne LIVE-PDFs. Kein Timestamp-Wasserstand: spät erzeugte PDFs und nachträglich sichtbare kleinere Nummern werden beim nächsten vollständigen Metadatenscan gefunden.
- Lokale Integrität: PDF-Header und SHA-256-Sidecar vor Überspringen prüfen. Fehlender Sidecar erzwingt Serververgleich; Widersprüche schlagen fehl. Vorhandene Originale werden über den bestehenden atomaren Writer niemals ersetzt. Ein Fehler liefert kein Erfolgsergebnis. Bei späterer Integration darf der Status erst nach vollständigem Erfolg atomar ersetzt werden; bestehende Statusfelder beibehalten.
- Grenze: lokale SHA-Prüfung erkennt keine nur auf dem Server geänderten PDFs. `fullVerify=true` lädt alle Originale und vergleicht bytegenau. Vor Aktivierung ersten Vollabgleich durchführen und separaten wöchentlichen Vollabgleich freigeben. Bis dahin bleibt der bestehende Fünf-Minuten-Vollabgleich aktiv. Kein selbst erfundener Server-Hash als Ersatz für den tatsächlich gespeicherten PDF-Inhalt.
- Rechnungs-RLS laut vorhandener Migration: RLS enabled, Rechte für public/anon/authenticated entzogen, service_role select/update. Backup-Service-Schlüssel bleibt ausschließlich lokal. Kandidat verwendet nur select. Produktive Grants/Policies sind damit noch nicht bewiesen. Die lokalen Migrationen decken die älteren Liga-Policies nicht vollständig ab.
- `vercel.json`: jobs jede Minute, status-jobs alle fünf Minuten. Status-Route prüft CRON_SECRET und danach SHOP_STATUS_SYNC_ENABLED. Kein Nachweis ihrer aktuellen produktiven Bereitstellung oder Flagwerte.
- `useMilestoneLaunch`: sofortiger RPC, danach alle 30 Sekunden und bei Fokus; keine Pause bei unsichtbaren Tabs. Zahlungsstatus-Polling ist separat und bleibt unverändert.

## Produktionsstand und ausstehende Evidenz

Die Analyse `supabase-disk-io-analysis-20261106.md` bleibt historische Messgrundlage: Nano, aktives Swapping, Records 30.768 kumulierte Calls. Diese Zahlen sind weder neue Messungen noch ein Nachweis, dass Backup Hauptursache ist. Kein Reset der Query-Statistik.

Letzter dokumentierter Verkaufsstart: 05.11., Deployment dpl_2bwzAjt53gbrRji67nsYVTjhPnvk. Read-only Vercel-API-Abfrage der letzten drei Produktionsdeployments scheiterte am 06.11. an ENOTFOUND. Aktuelle Deployment-ID, Alias-Zuordnung, Commit/Uploadquelle, aktive Cron-Konfiguration und nur die relevanten booleschen Flags müssen noch lesend verifiziert werden. Keine vollständigen Environment-Werte exportieren. Lokaler Git-HEAD vom September bildet die vielen uncommitteten Shop-Dateien nicht ab; er ist kein Produktionsnachweis.

Querypläne fehlen weiterhin. Vor Cache-/Index-Arbeit einmalig begrenzt im SQL-Editor oder mit bestehendem Diagnosezugang prüfen:

1. Aktuelle pg_policies, pg_class.relrowsecurity/relforcerowsecurity, Rollen-/Spaltenrechte und Views für records, hikers, events/events_master, hiker_season_stats, site_stats, Partnerbuchungen; RPC milestone_shop_is_live samt SECURITY DEFINER/search_path/EXECUTE-Rechten. Views ebenfalls auf wirksame RLS prüfen.
2. Bestehende Indizes und genaue normalisierte pg_stat_statements-Abfragen sichern, einschließlich Resetzeitpunkt und Messzeit. Queryparameter/Personendaten nicht in Dokumentation übernehmen.
3. Erst EXPLAIN (FORMAT JSON), ohne ANALYZE, mit denselben Spalten, Filtern, ORDER BY und LIMIT wie der tatsächliche PostgREST-Aufruf; tatsächliche Rolle anon/authenticated und repräsentative JWT-Claims innerhalb einer READ ONLY-Transaktion mit lokalem statement_timeout (z.B. 3s) setzen und anschließend ROLLBACK. Ein Owner/service_role-Plan allein bewertet RLS-Kosten nicht. PostgREST-JSON-Aggregation/Views/Policies mitberücksichtigen. DBA-Zugang nicht durch zusätzliche öffentliche Explain-Rechte ersetzen.
4. Erst nach Prüfung bei Bedarf ein eng begrenztes EXPLAIN ANALYZE SELECT in ruhigem Fenster ausdrücklich abstimmen: ANALYZE führt aus und erzeugt Last. Keine Schreib-RPCs analysieren. Geschätzte Kosten nicht als gemessene Zeit darstellen.

Ohne diese Evidenz keine Indexmigration und kein gemeinsamer Daten-Cache.

## Kleine Schritte mit separater Prüfung und Rückweg

| Priorität | Änderung | Nachweis / Freigabekriterium | Rückweg |
|---|---|---|---|
| 0 | Messbasis, Deployment-/RLS-/Planprüfung abschließen | Gleiche Messfenster, Rollen und aktuelle Produktionsquelle identifiziert | Keine Laufzeitänderung |
| 1 | Separaten Backup-Kandidaten integrieren, erst nach Freigabe | Initialer Vollvergleich; unveränderte Originale; Erfolg/Fehler/Status; tatsächlicher LaunchAgent-Node; keine Doppelstarts; wöchentlicher Vollvergleich | Bisheriges Skript und Zeitplan wiederverwenden; niemals PDFs löschen |
| 2 | Öffentliche identische Abfragen pro Request deduplizieren | Gleiches Ranking einschließlich Saison, Teilnehmer/Records und Sichtbarkeiten; Anzahl DB-Calls sinkt | Einzelnen Loader zurücknehmen |
| 3 | Einen geprüften öffentlichen Loader kurz cachen, z.B. 30–60s | Anonyme und angemeldete Antworten isoliert; Profilprivatisierung/Invalidierung; kein Cache von Fehlern; Query-Delta und TTFB besser | Cache für diesen Loader entfernen |
| 4 | Milestone-Polling bei hidden pausieren, bei visibility/focus einmal aktualisieren | Kein Poll bei hidden; Launch-Gate weiter serverseitig maßgeblich; keine parallelen Requests | Hook zurücksetzen |
| 5 | Shop-Leerlaufabfragen bündeln | Verkaufsreaktionszeit, Retry, Bestätigung und Fulfillment unverändert; kein Intervallwechsel während Kalenderverkauf ohne separate Prüfung | Worker-Version zurücksetzen |
| 6 | Nur belegte Index-/Aggregationsänderung | Produktionsähnlicher Plan/RLS vorher-nachher, Schreibkosten und Rollback bewerten; eigene Migrationsfreigabe | Geplanter Index-/Funktions-Rollback |

Compute Nano → Micro ist ein separater Infrastrukturentscheid: aktuellen Preis und mögliche Unterbrechung erneut prüfen; weder Upgrade noch Kostenänderung hier ausführen. Weniger PDF-Transfers beheben aktives Swapping nicht nachweislich.

## Vorher/Nachher und Abnahme

Lokaler deterministischer Test mit drei künstlichen PDFs, Seitengröße 2 (keine Produktionszugriffe):

| Szenario | Bisheriger Algorithmus (aus Code abgeleitet) | Kandidat (im Test gemessen) |
|---|---|---|
| Erstsicherung | 3 PDF-Transfers, 2 Listenqueries | 3 PDF-Transfers, 2 Metadatenqueries + 3 Einzelqueries |
| Unveränderter Folgelauf | 3 PDF-Transfers, 2 Listenqueries | 0 PDF-Transfers, 2 Metadatenqueries |
| Einzelne lokale PDF fehlt | 3 PDF-Transfers | 1 PDF-Transfer, unveränderte Dateien unangetastet |

Tradeoff: Erstsicherung erzeugt mehr Requests; reguläre Folgeläufe vermeiden große Payloads, nicht sämtliche Listenabfragen. Es wird noch jeder lokale PDF-Inhalt gehasht. PDF-Bytes-Metrik zählt dekodierte PDF-Nutzbytes, keine Netzwerkbytes/Base64/HTTP-Overheads. Unter den Annahmen ein LIVE-PDF, 288 Timerläufe/Tag, keine Änderungen: bisher etwa 288 PDF-Transfers/Tag, inkrementell nach Erstsicherung null plus separat freigegebene Vollprüfungen. Das ist eine Projektion, keine Produktionsmessung.

Kandidat liefert invoicesChecked, localVerified, pdfsDownloaded, pdfBytesDownloaded, newCopies, queries, fullVerify, durationMs. Bei Integration zusätzlich lastSuccess, Fehlerrate und Vollprüfdatum dokumentieren, ohne Kunden-/PDF-Inhalte oder Tokens zu loggen.

Produktionsbaseline und Nachmessung noch AUSSTEHEND: 24–48h vergleichbare Fenster vor/nach jeweils nur einem Schritt; Delta Calls/total_exec_time/rows je Query-ID; Resetzeit notieren; Swap-in/out pro Sekunde, IOPS/Throughput, I/O-Balance, CPU/RAM. Startseiten-TTFB/LCP p50/p95, kalter/warmer Abruf, Region, Geräteklasse und Stichprobengröße dokumentieren. Keine umfangreichen synthetischen Lasttests gegen laufenden Verkauf. Kalendertage/Traffic, Entwicklerzugriffe und Dashboardaktivität als Störgrößen erfassen. Ohne diese Werte keine behauptete Beschleunigung oder I/O-Ersparnis in Produktion.

Validiert: `node --test tests/invoice-backup.test.mjs tests/incremental-invoice-backup.test.mjs` – 2/2 bestanden. Fälle: Erstsicherung, Pagination, Null-Download-Folgelauf, fehlender Sidecar, gelöschtes PDF, lokale Korruption, serverseitige Abweichung beim Vollvergleich, fehlendes/später bereitgestelltes PDF, unveränderte Originale und ungültige Namen. Ausschließlich Temp-Verzeichnisse und Fake-Datenbank. Kein Build nötig: keine App-Datei oder Buildkonfiguration verändert.
