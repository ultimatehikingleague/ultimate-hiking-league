# Activity Connect – Wiesenttal-GPX

## Dateibefund

Der Outdooractive-Export vom 25.04.2026 enthält einen GPX-Track mit einem Segment und 585 Trackpunkten. Alle Punkte enthalten Koordinaten, Zeit und Höhe. Die Erweiterungen enthalten Kategorie- und Ortsklassifizierungen. Die Datei enthält keine gespeicherten Summen für Distanz, Aufstieg oder Bewegungszeit.

- UHL summiert die horizontale Luftlinie zwischen aufeinanderfolgenden Punkten innerhalb eines Segments. Alle 584 Punktverbindungen gehen in die Rechnung ein. Die Summe beträgt 13.617,55 m. Outdooractive zeigt 14,2 km, rund 582 m mehr. Eine Kontrollrechnung mit der Höhendifferenz je Verbindung ergibt 13.910,46 m. Die genaue Outdooractive-Berechnung lässt sich anhand dieses Exports nicht rekonstruieren. Die horizontale Berechnung bleibt unverändert.
- Der vorherige GPX-Parser ignorierte die Höhenpunkte. Die unbereinigte Summe positiver Höhendifferenzen beträgt 863 m. Der Import liest die Punktwerte jetzt aus, glättet innere Punkte mit dem Median von drei Messungen und ignoriert Höhenumkehrungen unter 3 m. Segmente werden getrennt ausgewertet. Bei fehlenden Höhenpunkten, zu kurzen Profilen oder auffälligen Sprüngen bleibt der Schätzwert leer. Für diese Datei ergibt das 625 m Aufstieg und 624 m Abstieg. Outdooractive zeigt 590 m und 587 m. Die UHL-Werte sind ausdrücklich als Schätzung gekennzeichnet.
- Zwischen 09:03:38 und 14:36:08 liegen 19.950 Sekunden bzw. 05:32:30. UHL schneidet Sekunden ab und zeigt 05:32. Die Anzeige 5:33 von Outdooractive ist mit Rundung auf die nächste volle Minute vereinbar. Die Bewegungszeit bleibt in UHL unbekannt.

[GPX-1.1-Spezifikation](https://www.topografix.com/GPX/1/1/)

## Lokale Änderungen

- `app/lib/activity/parse.ts` und `app/lib/activity/elevation.ts` lesen Höhenpunkte und kennzeichnen Summenwerte, Schätzungen und fehlende Werte.
- `app/lib/activity/normalize.ts` und `app/components/RecordSubmissionForm.tsx` zeigen importierte Distanzen mit maximal zwei Nachkommastellen. Bleibt die angezeigte Eingabe gleich, verwendet das Formular intern die volle importierte Genauigkeit. Bearbeitete Werte werden wie eingegeben übernommen.
- `app/components/ActivityImportPreview.tsx` und das Formular strukturieren Import, Vorschau, Ergänzungen und Einreichen in der dunklen UHL-Oberfläche.
- `tests/activity-import.test.mts` prüft Glättung, Segmentgrenzen, fehlende und auffällige Höhen, Distanzpräzision und die Zeit aus dem Nutzerbeispiel.

Die isolierte lokale Vorschau verarbeitet Originaldateien auf dem Rechner. Die Einreichung ist dort deaktiviert. Sie prüft weder Speicherung in Supabase noch den vollständigen Admin-Freigabeprozess.
