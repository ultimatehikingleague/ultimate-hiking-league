# UHL Eventkalender 2027 – Importvorbereitung

Prüftag 10.11.2026. Der Produktionsbestand wurde lesend abgefragt. SQL-Funktion und Datenpaket liegen zur Freigabe vor.

| Prüfung | Anzahl |
| --- | ---: |
| Historische Prüfzeilen aus Auftrag 1 | 620 |
| Aktuelle Masterevents im Kalender 2027 | 214 |
| Bestätigte Kandidaten geprüft | 80 |
| Vollständig und importbereit | 61 |
| Bestätigt, aber unvollständig | 11 |
| Quellen- oder Darstellungsprobleme | 8 |
| Zurückgestellt insgesamt | 19 |
| Kandidaten mit fehlenden Pflichtangaben | 12 |
| Bestätigte Dubletten unter den 80 Kandidaten | 0 |
| Geplante Masterevents | 61 |
| Geplante Distanzzeilen | 316 |

Die 12 Kandidaten mit fehlenden Pflichtangaben umfassen die 11 unvollständigen Fälle und B071 mit einem zusätzlichen Quellenkonflikt. Gezählt werden betroffene Veranstaltungen.

## Daten und Abgleich

Die Dateien liegen im Repository unter docs/event-calendar-import-2027/. Der ursprüngliche Bericht und seine CSV-Dateien liegen im Workspace unter Eventkalender-2027-Analyse/.

- kandidaten.csv enthält die 80 Entscheidungen mit historischen Referenzen, offiziellen Quellen, belegten Distanzen und den Gründen für jede Rückstellung.
- kalenderstand.json enthält die 214 öffentlich lesbaren Masterevents und Distanzen des Vergleichsstands. Der lokale Test reproduziert dessen produktiv ermittelte Prüfsumme.
- aehnlichkeitstreffer.json dokumentiert auffällige Namens- und Quelltreffer.
- warteliste.csv enthält die zusammengeführten Recherchefälle.
- anfrage.json enthält genau den zur Freigabe vorgesehenen Batch.
- vorbereitung.py erzeugt die lokalen Übersichten erneut aus dem historischen Bericht und dem Vergleichsstand.
- bestand.sql liest die Bestandsprüfsumme. schema-pruefung.json dokumentiert die lesend geprüften Produktionsregeln.
- import.sql enthält den SQL-Entwurf. test.cjs und testergebnis.json dokumentieren den lokalen Test.

Der Abgleich nutzt Termin, Veranstaltungsidentität, Veranstalter, Land, Ort, Distanz und offizielle Quelle. Ähnliche Titel derselben Serie in verschiedenen Orten oder zu verschiedenen Terminen blieben getrennt. Der dokumentierte Kalenderbestand enthält auch die 2027-Ausgaben, die keiner historischen Prüfzeile zugeordnet waren. Die 214 Kalendereinträge und die 149 historischen A-Prüfzeilen aus Auftrag 1 sind unterschiedliche Zählgrößen.

Die Belege aus Auftrag 1 mit Quellenstand 09.11.2026 sind erhalten. Ergänzende Nachprüfungen am 10.11.2026 konzentrierten sich auf mehrtägige Ausgaben und erkennbare Konflikte. Die übrigen offenen historischen Fälle wurden in diesem Durchlauf nicht erneut im Internet recherchiert.

## Entscheidungen bei einzelnen Veranstaltungen

- **B041 Blankenberge** erhält den Titelzusatz „(Sonntag)“, weil die Sonntagsausgabe separat ausgeschrieben ist. Der bestehende Samstag M629 bleibt bestehen. [Verbandskalender](https://wandel.be/wandelkalender/9239/)
- **B057 Nijmegen** enthält 30, 40 und 50 km pro Tag. Der Zeitraum 20.–23. Juli steht in der Beschreibung. **B058 Someren** enthält die drei offiziell angekündigten Distanzen 8, 40 und 80 km. [4Daagse-Distanzregeln 2027](https://www.4daagse.nl/deelnemen/burger/afstanden), [Kennedymars Someren](https://www.kennedymars.nl/)
- **B061 Karwendelmarsch** verwendet Achensee Tourismus und Region Seefeld als Veranstalter. **B062 Koasamarsch** enthält die vier ausgeschriebenen Wanderstrecken 5, 8, 20 und 33 km. Die Trailrun-Disziplinen sind separat ausgeschrieben. [Karwendelmarsch-Renninformationen](https://www.karwendelmarsch.info/wichtige-informationen/), [Koasamarsch-Strecken](https://www.koasamarsch.at/de/strecken.html)
- **B072 München** ist die Sommerausgabe in Krailling. **B076 Weserbergland** ist der separat buchbare Nachtmarsch über 50 km, während M702 die Tagesausgabe ist. [Mammutmarsch Sommerausgabe](https://mammutmarsch.de/events/muenchen), [Megamarsch Weserbergland bei Nacht](https://www.megamarsch.de/weserbergland-bei-nacht)
- **B079 Schaffhausen** verwendet die ausgeschriebene Stadt. Die genaue Startadresse ist noch offen. Die Beschreibung kennzeichnet 50 km als offizielles Zwischenziel des 100-km-Marschs. [Megamarsch Schaffhausen](https://www.megamarsch.de/schaffhausen)
- **B080 Nord-Marsch Hamburg** hat belegte Startzeiten für jede Distanz. Die 55, 85, 100 und 110 km starten am 8. Oktober, die 16, 30, 43 und 60 km am 9. Oktober. Ein Masterevent beginnt am 8. Oktober. Die Beschreibung enthält die Tageszuordnung und weist auf die zwei unterschiedlichen Uhrzeitangaben zum Ende am 10. Oktober hin. [Nord-Marsch Hamburg](https://www.nord-marsch.de/event-details/nord-marsch-hamburg)
- **B074 Berlin und B075 München** bleiben zurückgestellt. Der Jahreskalender nennt die Ausgaben für 2027, die erreichbaren Detailseiten zeigen noch 2026. Es wurde kein Startort aus diesen alten Detailseiten übernommen. [Mammutmarsch-Jahresübersicht](https://mammutmarsch.de/events), [Detailseite Berlin](https://mammutmarsch.de/events/berlin), [Detailseite München](https://mammutmarsch.de/events/mammutmarsch-muenchen)
- **B046, B047 und B052 Ieper** werden zusammen geprüft, sobald die Strecken für den ersten Tag belegt sind. Die Tagesausgaben bleiben in der Warteliste einzeln adressierbar. **B055, B064, B069 und B071** bleiben wegen unterschiedlicher Angaben zu Terminen, Umfang oder Strecken offen.

## Warteliste

Die 426 Vorgänge umfassen 61 importbereite Fälle, 11 unvollständige, 8 mit Quellen- oder Darstellungskonflikten, 320 zur weiteren manuellen Prüfung, 24 ohne bestätigte Ausgabe 2027 und 2 belegte Ausfälle.

Alle 471 historischen Nicht-A-Referenzen aus Auftrag 1 sind in der Warteliste nachweisbar. Sichere Zuordnungen behalten sämtliche historischen Referenzen. Historische Wiederholungen wurden konservativ über normalisierten Namen, Ort, Land und Veranstalter zusammengeführt. Unklare Identitäten und unterschiedliche Tagesausgaben bleiben einzeln prüfbar. Stabile Wartelisten-IDs ermöglichen spätere Rechercheläufe. Nach erfolgreicher Übernahme des geplanten Batches blieben 365 Vorgänge in der Warteliste.

## Importmechanismus und Freigabe

Der bestehende Admin-Ablauf in app/admin/page.tsx, Funktion handleCreateEvent, speichert Master und Distanzen in getrennten Anfragen. Für diesen Import liegt deshalb eine eigene transaktionale Funktion vor. Der bestehende Admin-Ablauf ist unverändert.

events_master speichert die Veranstaltung. event_distances speichert die Kilometer je Veranstaltung über event_id. Das Schema verlangt technisch Titel, Slug, Masterreferenz und Kilometerzahl. Dieser Import verlangt zusätzlich das belegte Datum, Ort, Land, Veranstalter, offizielle Quelle und positive Distanzen. Eine genaue Straßenadresse und ein separater Anmeldelink sind optional. Das Schema bietet ein Veranstaltungsdatum. Bestätigte Mehrtageszeiträume und Starttage je Distanz stehen deshalb in der Beschreibung.

import.sql legt genau eine Funktion mit SECURITY INVOKER an. Ausführen darf sie nur eine angemeldete Person mit bestehender Admin-Zuordnung. Die vorhandenen Rechte, RLS-Policies, Slug-Eindeutigkeit und Distanz-Fremdschlüssel gelten weiter. Der Entwurf ändert keine Schutzregeln und schreibt weder mit Service Role noch über das SQL-Editor-Administratorkonto in die Eventtabellen.

Der Batch läuft in einer Transaktion. Ein kurzer Tabellenlock mit NOWAIT verhindert parallele Schreibvorgänge während der Prüfung und Anlage. Öffentliche Lesezugriffe bleiben möglich. Die Prüfsumme umfasst den geprüften Bestand mit IDs, Namen, Slugs, Termin, Ort, Land, Veranstalter, offizieller Quelle, Status und Distanzen. Abweichungen stoppen den Lauf. Bei einer Wiederholung werden inhaltlich identische, bereits importierte Kandidaten separat geprüft und übersprungen. Ein abweichender Eintrag unter demselben Slug oder ein Inhaltskonflikt stoppt den ganzen Batch. Master und Distanzen werden gemeinsam gespeichert. [Supabase-Funktionsdokumentation](https://supabase.com/docs/guides/database/functions), [PostgreSQL-Tabellenlocks](https://www.postgresql.org/docs/16/sql-lock.html)

Vor der ersten produktiven Änderung ist die ausdrückliche Freigabe für die Funktionsanlage und den Batch erforderlich. Danach folgen ein erneuter vollständiger lesender Kalenderabgleich, die Anlage der Funktion und der Import in einer vorhandenen angemeldeten Adminsitzung. Während des kurzen Importfensters sollten keine manuellen Eventimporte parallel laufen, da diese ihren Vergleich bereits vor dem Lock durchgeführt haben können. Anschließend werden tatsächlich angelegte IDs, übersprungene Datensätze und eventuelle Konflikte protokolliert.

## Lokaler Probelauf

Der vollständige Batch lief auf PGlite 0.5.0 mit den 214 Vergleichseinträgen und einer lokalen Nachbildung der relevanten Tabellen und Schutzregeln. Der Lauf legte **61 Masterevents und 316 Distanzen** an. Eine sofortige Wiederholung übersprang alle 61. Die Prüfsumme des ursprünglichen Bestands blieb gleich.

Unberechtigte Rollen, doppelte Kandidaten, ungültige Distanzen, eine veraltete Prüfsumme sowie Slug- und Inhaltskonflikte wurden abgewiesen. Ein absichtlich bei der letzten Veranstaltung ausgelöster Distanzfehler rollte den gesamten Batch zurück.

Die Prüfung lief in einer lokalen Datenbankverbindung. Ein Mehrverbindungstest für konkurrierende Schreibvorgänge und ein authentifizierter Lauf auf einer separaten Supabase-Staging-Instanz stehen aus. Der lokale Test ist mit installiertem @electric-sql/pglite@0.5.0 und node docs/event-calendar-import-2027/test.cjs reproduzierbar. Die Bibliothek wurde außerhalb des Repositories installiert.

Produktiv wurden **0 Veranstaltungen und 0 Distanzen** angelegt. Der öffentliche Kalender und beide Shops wurden nicht verändert.
