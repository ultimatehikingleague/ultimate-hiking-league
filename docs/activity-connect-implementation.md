# UHL Activity Connect – Entwicklungsstand und Testbericht

## Umsetzung

- `app/lib/activity/normalize.ts` enthält die gemeinsame Dauer- und Zulassungsbewertung. Sekunden werden durch ganzzahlige Division in volle Minuten überführt. Die Bewertung unterscheidet regulär, Kulanzfall und unvollständige Nachweislage. Die Entscheidung liegt weiterhin bei der Moderation.
- `app/lib/activity/parse.ts` liest GPX und TCX mit einem begrenzten XML-Parser ohne DTD und FIT mit dem Garmin SDK samt Integritätsprüfung. Die Vorschau führt Gesamtzeit und Bewegungszeit getrennt. Distanz aus Gerätewerten hat Vorrang. Berechnete GPS-Distanz überspringt Segmentgrenzen und wird bei auffälligen Sprüngen nicht automatisch übernommen. GPX-/TCX-Höhenmeter aus Rohpunkten werden nicht als belastbare Aufstiegssumme geschätzt. TCX-Rundenzeit wird mangels eindeutiger Bewegungszeit-Semantik nicht als Bewegungszeit ausgegeben. Vollständige GPS-Koordinaten verbleiben im Original. Externe Anbieter-IDs und der plattformübergreifende Ähnlichkeitsvergleich sind späteren Anbindungen vorbehalten.
- `app/components/RecordSubmissionForm.tsx` zeigt die Vorschau und übernimmt erkannte Werte in das vorhandene Formular. Die Einreichung verwendet den bestehenden Pending-Pfad und die bestehenden Pflichtfeld- und Eventprüfungen. `app/components/ActivityImportPreview.tsx` und `app/admin/page.tsx` zeigen Dateiwerte, Auffälligkeiten und Download im Nachweisbereich. Kulanzfälle werden auch bei manuellen Einreichungen markiert, sofern beide eingereichten Werte vorliegen und unter den Grenzen liegen.
- `app/api/activity-import/route.ts` begrenzt die Datei auf 4 MB, verarbeitet die Vorschau ohne Speicherzugriff, speichert bei Einreichung das Original privat und lädt es erst nach Authentifizierung und einer Abfrage der Einreichung unter der aktuellen Nutzeridentität. Der Objektpfad muss dem Eigentümer der Einreichung entsprechen. Ein identischer Dateiinhalt unter demselben Konto wird per SHA-256 erkannt und als Hinweis angezeigt. Eine erneute bewusste Einreichung ist möglich.
- `supabase/migrations/20261112_activity_originals.sql` enthält den privaten Bucket, die bucketbezogene Sperre für direkte Clientzugriffe und einen partiellen eindeutigen Index für den Nachweisverweis pro Einreichungsversuch. Der Index gilt ausschließlich für die neuen Nachweisreferenzen. Vorhandene Screenshot-Buckets und Record-Dublettenprüfung werden nicht geändert. Die Migration wurde nicht auf Produktion angewendet.
- `package.json` und `package-lock.json` ergänzen `@garmin/fitsdk` und `saxes`.

## Wiederholungsversuche und Fehlerfälle

| Schritt | Vorhandener Pfad | Behandlung |
| --- | --- | --- |
| Screenshot hochladen | Drei Uploadversuche mit 1,2 Sekunden Wartezeit. Derselbe Objektpfad wird wiederverwendet. | Bestehender Code bleibt wirksam. |
| Einreichung speichern | Ein INSERT in `record_submissions`; Fehler wird im Formular angezeigt. | Bei erneutem Absenden eines Dateiimports wird derselbe Nachweisverweis verwendet. Der vorbereitete eindeutige Index verhindert eine doppelte Einreichung desselben Versuchs. Nach einem INSERT-Fehler wird geprüft, ob die vorherige Speicherung bereits erfolgreich war. Der Wiederholungsschutz gilt im geöffneten Formular. |
| Verifizierten Record speichern | Ein INSERT in `records`, nach den vorhandenen Event-Zuordnungen. Die vorhandene Eindeutigkeit prüft Hiker, Datum, Distanz und Dauer. | Bestehender Ablauf und Constraint bleiben bestehen. |
| Einreichungsstatus aktualisieren | Ein getrenntes UPDATE nach dem Record-INSERT. | Scheitert das UPDATE, kann der Record bereits in der Wertung stehen, während die Einreichung offen bleibt. Der Client behandelt einen späteren Dublettenfehler nicht als Beweis für eine erfolgreiche Freigabe. |

Die installierte PostgREST-Bibliothek wiederholt unter bestimmten Bedingungen lesende HTTP-Aufrufe, jedoch keine INSERT- und UPDATE-Aufrufe. Für eine spätere zuverlässige Freigabe bietet sich eine einzige serverseitige Datenbanktransaktion an. Sie sperrt die Einreichung, prüft Adminrecht und Status unter den geltenden Policies, verknüpft den Record eindeutig mit seiner Einreichung und speichert Record und Freigabestatus gemeinsam. Eine Wiederholung liefert dann die bereits verbuchte Record-ID zurück. Ein fachlich ähnlicher oder zuvor anderweitig angelegter Record wird weiterhin als Konflikt behandelt. Eine solche Umstellung ist nicht Teil dieser Änderung.

## Tests

- Acht automatisierte Tests erfolgreich. `node --import tsx --test tests/activity-import*.test.mts`
- Geprüft wurden GPX, TCX und eine synthetische FIT-Datei, FIT-Prüfsummenfehler, defektes XML, DTD, falsche Endung, Größenlimit, fehlende Zeit- und Höhendaten, GPS-Sprünge und getrennte GPX-Segmente. Die Beispiele 04:51:15, 04:51:59, 04:59:59 und 05:00:00 ergeben 04:51, 04:51, 04:59 und 05:00.
- Die API-Tests simulieren Supabase. Sie prüfen anonyme und fremde Zugriffe, privaten Download, ausbleibenden Upload bei Vorschau, Erkennung identischer Dateien und stabile Referenzen bei Wiederholung. Sie ersetzen keinen Test der tatsächlichen Supabase-RLS oder Datenbanktransaktionen.
- TypeScript und lokaler Produktions-Build bestanden. ESLint für die neuen Dateien ohne Befunde. In den bestehenden Formular- und Admin-Dateien meldet ESLint vorhandene `any`-Typen und im Admin bestehende Bild-Warnungen.
- Noch offen sind ein kompletter Test mit echtem lokalem Supabase samt Benutzer- und Admin-Anmeldung, Migration, gleichzeitiger Wiederholung, Nachweis-Download, Freigabe und Prüfung der Wirkung auf Profil, Rangliste und Challenges sowie die visuelle Mobil-/Desktop-Prüfung. In dieser Umgebung stand keine isolierte laufende Supabase-Instanz zur Verfügung.

## Nächste Schritte vor Freigabe

1. Isolierte lokale Supabase-Instanz mit dem relevanten UHL-Schema einrichten. SQL dort ausführen und das Frontend mit lokalen Supabase-Zugangsdaten sowie `NEXT_PUBLIC_ACTIVITY_IMPORT_ENABLED=true` im Entwicklungsmodus starten. Der neue Endpunkt akzeptiert derzeit ausschließlich eine Supabase-Adresse auf dem lokalen Rechner.
2. Vollständigen Ablauf mit separaten Nutzer- und Admin-Konten testen. Dabei auch prüfen, ob ein direktes Schreiben in den privaten Bucket blockiert wird und die vorhandenen Screenshot-Uploads weiterhin funktionieren.
3. Aufbewahrungsdauer für Originale und verwaiste Uploads festlegen. Ein Upload kann gespeichert sein, wenn danach das Anlegen der Einreichung scheitert. Vor produktiver Nutzung einen Löschprozess vorsehen, der noch referenzierte Originale und die Prüfbarkeit bestehender Einreichungen berücksichtigt. Konto-/Datenschutzinformationen auf die private Originalspeicherung abstimmen.
4. Für den produktiven Einsatz die Konditionen des Garmin FIT SDK prüfen und die Aktivierung separat freigeben. Das SDK für Dateien und die Zulassung für die Garmin Connect API sind getrennte Themen. Die Anbieterreihenfolge bleibt Garmin, Polar, Strava. Die offiziellen Zugangsbedingungen, Daten und Einschränkungen stehen in `docs/activity-connect-phase1.md`. [Garmin FIT SDK](https://github.com/garmin/fit-javascript-sdk), [Garmin Developer Program](https://developer.garmin.com/gc-developer-program/overview/)
