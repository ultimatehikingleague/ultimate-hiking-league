# Authentifizierter Rollback-Test

Sicherung laut Dashboard-Prüfung durch den Projektinhaber: 11.11.2026, 03:09:20 UTC. Eine Wiederherstellung wurde nicht getestet.

1. Die Benutzer-UUID des bestehenden UHL-Admins in Supabase unter Authentication → Users ermitteln. Der Test ist an diese UUID gebunden. Die UUID allein authentifiziert niemanden.
2. Den vollständigen öffentlichen Kalender 2027 samt Distanzen lesend erfassen. Den Stand mit `kalenderstand.json` vergleichen und bei Abweichungen stoppen. Die Funktion prüft zusätzlich die fachliche Prüfsumme im selben Aufruf und bricht bei bereits vorhandenen Kandidaten ab.
3. Mit `node rollback-sql.cjs <Admin-UUID>` aus diesem Verzeichnis das Installations-SQL erzeugen und im Supabase SQL Editor ausführen. Der Editor installiert ausschließlich die Funktion. Die Event-Schreibversuche laufen über die normale UHL-Sitzung und deren Datenbankrechte.
4. Die lokale UHL-Administration öffnen und mit der bestehenden UHL-Anmeldung den Rollback-Test einmal auslösen. Im Erfolgsfall meldet die Oberfläche 61 Veranstaltungen und 316 Distanzen. Auch bei einem Fehler oder einer fehlenden Antwort zunächst den Kalender erneut unabhängig abfragen.
5. Den vollständigen Vorher- und Nachher-Stand vergleichen. Nach Ende des Tests die Funktion mit `drop function public.test_reviewed_uhl_events_2027();` entfernen. Dadurch entfallen ihre Berechtigungen. Anschließend die lokale Schaltfläche entfernen.

Ein Rollback kann Lücken in den ID-Sequenzen hinterlassen. Der Test legt keine dauerhaften Event- oder Distanzzeilen an. Eine gesonderte Freigabe ist für den späteren produktiven Import erforderlich.

## Ergebnis vom 11.11.2026

Die angemeldete UHL-Admin-Sitzung meldete 61 geprüfte und zurückgerollte Veranstaltungen sowie 316 Distanzen. PostgreSQL 17.6 bestätigte SECURITY INVOKER und fehlende Ausführungsrechte für anon und service_role. Die Funktion prüfte außerdem die fest hinterlegte Admin-UUID und deren Eintrag in admin_users.

Die unabhängig abgerufenen Vorher- und Nachher-Daten stimmen bytegenau überein. Beide enthalten 214 Veranstaltungen und 525 Distanzzeilen. SHA-256 beider Aufnahmen: `396e6af612466c93c36fcc915a82407f0b207951c1fb2250686c2ba55021e93c`.

Die Testfunktion samt Ausführungsrechten wurde aus Supabase entfernt und ihre Abwesenheit geprüft. Die lokale Schaltfläche wurde entfernt. Der produktive Eventimport bleibt ausstehend.
