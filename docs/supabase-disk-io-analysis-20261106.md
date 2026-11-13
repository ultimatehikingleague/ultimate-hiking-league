# Supabase Disk-I/O – ausschließlich lesende Analyse vom 06.11.2026

## Ergebnis und Grenzen

Es bestehen Hinweise auf anhaltenden Speicherdruck, nicht allein einen einzelnen kurzen Query-Peak. Die Ursache ist nicht eindeutig einem Shop-Prozess zuzuordnen. Zwei authentifizierte Metrics-Snapshots im Abstand von 3.357 Sekunden zeigen aktives Swapping und laufende Disk-I/O. Eine dauerhafte Überlastung über mehrere Tage ist damit noch nicht bewiesen. Historische IOPS-/Throughput-Diagramme konnten im Dashboard nicht geladen werden; eine genaue Zuordnung zur Uhrzeit der E-Mail bleibt offen.

Keine Prozesse, Datenbankstrukturen, Tarife, Zahlungs- oder Fulfillment-Daten geändert. Auftrag 3 weder migriert noch veröffentlicht oder aktiviert. Keine Worker-Endpunkte ausgelöst. Nur Dashboard, Metrics-GET und kleine Tabellenzählungen gelesen. Auch diese Diagnoseabfragen verursachen geringe zusätzliche Last; ihre Beteiligung ist nicht separat messbar.

## Produktionsmessungen

- Organisation Pro, Datenbankinstanz weiterhin Nano, Dashboard: bis 0,5 GB RAM; Metrics: rund 409 MiB verfügbarer Gesamtspeicher.
- Rund 381 MiB Swap belegt. Entscheidend: Swap-in +1.008.913 und Swap-out +924.484 Seiten zwischen den Messungen; also aktive Auslagerung, nicht lediglich alter belegter Swap.
- Gerät nvme1n1: +30.879.637.504 gelesene Bytes und +3.868.897.280 geschriebene Bytes; durchschnittlich etwa 9,20 MB/s Lesen und 1,15 MB/s Schreiben. Rund 372 Lese- und 109 Schreiboperationen pro Sekunde. Gerätezuordnung und budgetrelevante Aggregation nicht unabhängig verifiziert; nicht mit einer garantierten Budget-Abrechnungsrate gleichsetzen.
- Keine neuen PostgreSQL-Tempdateien im Messfenster. Alte kumulierte Tempdatei-/Diskzähler dürfen nicht als heutiger Verbrauch interpretiert werden.
- CPU im Dashboard gering (Momentaufnahmen ca. 4–8 %), Memory commitment mit „Severe“ markiert. Dies ist ein Indiz, keine alleinige Diagnose eines Speicherlecks.
- Datenbank insgesamt ca. 37,8 MB; provisionierte Disk 8 GB, etwa 4 % belegt. Kein Speicherplatzmangel.
- I/O-Balance in der Infrastrukturansicht 77 %, Übersicht zuvor 64 % für anderes Zeitfenster. Unterschiedliche Aggregationen, kein Nachweis, dass zwischenzeitlich niemals 0 % erreicht wurde.
- Tabellenzählungen: shop_orders 7, shop_payments 4, shop_invoices 2 (davon eine LIVE), shop_fulfillment 2. Neue shop_fulfillment_units noch nicht vorhanden.

## Prozesse und tatsächliche Query-Beobachtungen

| Quelle | Verhalten | Bewertung |
|---|---|---|
| `vercel.json`, `app/api/shop/jobs/route.ts` | Bestehender minütlicher Job: Bestätigungen und Fulfillment-Queue prüfen | Regelmäßige Grundlast auch ohne neue Bestellung. Nicht deaktivieren, da Verkaufsabwicklung davon abhängt. |
| `app/lib/shop/confirmations.ts` | Fehlende Rechnungen/Bestätigungen sowie Widerrufsbenachrichtigungen suchen | Mehrere kleine Abfragen pro Minute. Mit aktuellem Datenbestand kein starker Hauptverursacher belegt. |
| `app/lib/shop/fulfillment.ts`, `supabase/migrations/20261104_shop_hosted_fulfillment.sql` | Queue-Claim; nur bei anstehendem Auftrag externe Übergabe | Keine fortlaufende Gelato-Statusabfrage aller abgeschlossenen Aufträge im bestehenden Worker. |
| Neue `app/api/shop/status-jobs/route.ts`, `app/lib/shop/status-sync.ts` | Geplanter 5-Minuten-Abgleich, standardmäßig ausgeschaltet | Auftrag 3 nicht produktiv aktiviert; erklärt aktuelle Warnung nicht. |
| `scripts/sync-shop-invoices.mjs` | Alle LIVE-Rechnungen einschließlich `pdf_base64` alle 300 Sekunden erneut laden und lokal vergleichen | Vermeidbare Wiederholung. Heute bislang 78 erfolgreiche Läufe im geprüften Log, jeweils eine Rechnung, keine neuen PDFs. Derzeit klein, mit Wachstum problematisch. |
| `~/Library/LaunchAgents/de.ultimate.shop-invoice-backup.plist` | RunAtLoad + StartInterval 300, LowPriorityIO | Lokaler Mac-Zeitplan; niedrige lokale I/O-Priorität reduziert nicht automatisch Supabase-Abfragen. |
| `app/page.tsx` | `force-dynamic`, mehrere Hiker-/Records-/Event-Abfragen pro Aufruf | Stärkerer Optimierungskandidat: öffentliche Daten gezielt zwischenspeichern/aggregieren. |
| `app/lib/useMilestoneLaunch.ts` | Status-RPC alle 30 Sekunden und bei Fensterfokus | Zusätzliche Last pro geöffnetem Account-Tab; im beobachteten Queryreport geringe kumulierte Laufzeit. |
| `app/lib/shop/admin-metrics.ts` | Alle LIVE-Zahlungen seitenweise für Kennzahlen laden | Aktuell nur wenige Zeilen; später serverseitige Aggregation statt vollständiger Datenübertragung. |
| `app/shop/bestellung/OrderStatus.tsx` | Zahlungsstatus alle 3 Sekunden, maximal 20 Versuche | Begrenztes Polling, keine nachgewiesene Endlosschleife. |

Der Query-Performance-Report ist kumuliert seit dem letzten Reset, nicht automatisch „heute“. Größte einzelne Ligaseiten-Abfrage: records nach activity_date, 30.768 Aufrufe, 13m52s insgesamt (17,6 %), durchschnittlich 27 ms. Weitere häufige Abfragen betreffen Höhenmeter, Ranglisten und Events. Hohe Cache-Hitraten belegen nicht geringe Betriebssystem-I/O bei Swapping.

Gefilterter Shop-Report: shop_claim_fulfillment 2.485 Aufrufe / etwa 62 s insgesamt; alter Test-Claim 3.029 Aufrufe / 16,66 s; Suche fehlender Rechnungen 2.498 Aufrufe / 6 s; lokaler Rechnungsdownload 180 Aufrufe / 2,61 s. Prozentwerte im gefilterten Report beziehen sich auf die gefilterte Auswahl, nicht die gesamte Datenbanklast. Keine dieser Zahlen weist allein den physikalischen I/O-Verbrauch nach.

Auch Dashboard-Metadatenabfragen erscheinen mit erheblicher kumulierter Laufzeit (Extensions etwa 5m34s, Zeitzonen etwa 3m). Entwicklungsarbeit, lokale Seiten gegen dieselbe Produktionsdatenbank sowie Dashboard-Nutzung können daher beitragen. Eine konkrete Lastspitze allein durch Build/Entwicklung ist nicht bewiesen.

Supabase Cron ist im produktiven Dashboard nicht installiert (Install integration angezeigt, nur Data API und Vault als installiert). Damit kein Hinweis auf eigene pg_cron-Jobs dort. Supabase-interne Wartungs-/Backup-Prozesse existieren unabhängig davon. Vercel-API-Ausführungsprotokolle waren mit dem vorhandenen CLI-Zugang nicht abrufbar (HTTP 403); deren tatsächliche Tageszahl ist deshalb nicht vollständig geprüft.

## Empfohlene Reihenfolge – noch nicht umgesetzt

1. Nano/Micro prüfen: Dashboard bietet Micro mit 1 GB als „Free Upgrade“ zum identischen angezeigten Stundenpreis 0,01344 USD an. Vor Änderung Kostenansicht und notwendige Neustartunterbrechung prüfen und freigeben lassen. Mehr RAM ist angesichts aktiven Swappings der stärkste unmittelbare Ansatz; kein Erfolg garantiert.
2. Rechnungsbackup inkrementell machen: erst kleine Metadaten, nur fehlende PDFs laden. Integritätsprüfung getrennt und seltener; lokale automatische Sicherung beibehalten.
3. Öffentliche Ligadaten gezielt cachen, redundante Ranglisten-/Records-Abfragen bündeln, danach mit Queryplänen/RLS prüfen. Keine pauschalen Indexmigrationen ohne Messung.
4. Leerlaufabfragen des Shop-Jobs bündeln; Verkaufsreaktionszeit erhalten. Neuen Gelato-Abgleich erst nach Klärung aktivieren, abgeschlossene Sendungen aus regelmäßiger Abfrage nehmen, begrenzte Batches und Fehler-Backoff erhalten.
5. Account-Polling bei unsichtbaren Tabs pausieren und künftige Admin-Kennzahlen aggregieren.
6. Über 24–48 Stunden I/O-Balance, IOPS, Swap-Raten und Antwortzeiten vergleichen; Warnzeitpunkt einbeziehen. Erst danach zusätzlichen kostenpflichtigen Computebedarf beurteilen. Mehr Diskplatz allein ist hier nicht die begründete Lösung.

## Offizielle Erläuterungen

- https://supabase.com/kb/troubleshooting/exhaust-disk-io – I/O-Budget, Baseline und mögliche Ursachen einschließlich Speicherdruck.
- https://supabase.com/docs/guides/platform/compute-and-disk – Compute-/Disk-Grenzen und I/O-Balance-Aggregation.
- https://supabase.com/docs/guides/observability/metrics – Metrics-Snapshots und Monitoring.

Die Warnung betrifft die Geschwindigkeit bzw. das Burstbudget der Datenträgerzugriffe, nicht allein die belegten Gigabytes.
