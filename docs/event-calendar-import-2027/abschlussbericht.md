# Produktiver Eventimport 2027 am 11.11.2026

Der Import lief in einer bestehenden UHL-Admin-Sitzung unter den vorhandenen RLS-Regeln. Der produktive Leseabgleich bestätigte 61 neu angelegte Veranstaltungen und 316 zugehörige Distanzzeilen. Der Kalender enthält 275 Veranstaltungen und 841 Distanzzeilen für 2027. Die 214 vorhandenen Veranstaltungen und ihre 525 Distanzen stimmten in allen abgefragten Feldern mit dem Stand vor dem Import überein.

[Importprotokoll](import-ergebnis.json) enthält jede Kandidaten-ID, die zugehörige produktive Event-ID sowie alle neuen Distanz-IDs, Kilometerwerte und Bezeichnungen. Übersprungene Kandidaten und Fehler: 0. Die 61 Slugs, Namen, Orte, Länder, Termine, Veranstalter, offiziellen URLs und Distanzlisten stimmen mit dem freigegebenen Batch überein. Der Abgleich gegen alle 275 Veranstaltungen fand für die importierten Einträge keine Kollision nach Slug oder nach Datum, Land und normalisiertem Titel. Alle 841 Distanz-IDs sind eindeutig.

Die temporäre Importfunktion samt Ausführungsrechten wurde aus Supabase entfernt. Die Entfernung wurde im Datenbankkatalog bestätigt. Die lokale Schaltfläche wurde entfernt. Beide Shops waren außerhalb des Änderungssatzes.

[Recherche-Warteliste](warteliste.csv) enthält weiterhin alle 426 Fälle samt Quellen und historischen Referenzen. Die 61 importierten Fälle tragen den Status „Importiert – erledigt“ und die produktive Event-ID. Die übrigen 365 Fälle behalten ihre bestehenden Prüfstände, darunter auch Fälle mit belegtem Ausfall. Für die spätere Recherche für 2028 und die Übernahme nach Supabase ist diese Datei der Ausgangspunkt. Die ursprüngliche Importvorbereitung erzeugt einen Stand vor dem Import und darf diese fortgeschriebene Liste nicht überschreiben.
