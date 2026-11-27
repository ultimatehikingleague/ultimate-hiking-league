# Veranstaltungsbewertungen

Die Bewertungstabellen sind von den Liga- und Shop-Daten getrennt. Die Migration wird vor dem Frontend ausgerollt. Die öffentlichen Bewertungsrouten sind unter `/leaderboard/event-reviews`, `/leaderboard/organizer-reviews`, `/organizers/[slug]` und den vorhandenen Veranstaltungsseiten erreichbar. Der Adminbereich liegt unter `/admin/event-reviews`.

## Kalenderzuordnungen

Die Migration enthält vier anhand produktiver Kalenderdaten abgeglichene Megamarsch-Ausgaben. Der Abgleich setzt die erwarteten Kalenderdaten voraus. Die übrigen Zuordnungen werden anhand der vorhandenen Prüfliste im Bewertungs-Admin gepflegt. Dieselbe Veranstaltungsreihe und dieselbe Organisation behalten ihren Slug. Der Organisator wird pro Ausgabe festgelegt. Namensänderungen erfolgen über die eigene Funktion im Adminbereich. Nach dem Zuordnen einer neuen Ausgabe erscheint der aktuelle Reihenwert automatisch im Kalender.

## Verifizierung und Moderation

Die bestehende Verifizierungsmarkierung ist `records.verified`. Der Bewertungszugriff benötigt einen verifizierten Record mit eindeutiger Ausgabe und Distanz sowie eine zugehörige, vom selben registrierten Konto selbst abgegebene und freigegebene Veranstaltungseinreichung. Eine Profilübernahme, ein Merge oder ein Ergebnislistenimport erzeugt keine Berechtigung. Bereits freigegebene Einreichungen werden nur bei einem beidseitig eindeutigen Abgleich verknüpft. Bei künftigen Freigaben hält der Übergang durch einen Administrator die Verknüpfung fest. Bei vorhandenen Aktivitätsdaten zählt das Kalenderjahr der tatsächlichen Teilnahme. Andernfalls gilt das Jahr der Ausgabe. Die Rücknahme der Verifizierung entzieht die Bewertung dauerhaft der öffentlichen Anzeige. Die Freigabe einer Bewertung bleibt eine separate Adminaktion.

Analysiere bei Löschanfragen auch die Freitexte. Einzelne Kommentare können dauerhaft aus der Bewertung entfernt werden, während die Sterne erhalten bleiben. Bei Kontolöschung oder Profillöschung werden gültige freigegebene Bewertungen vom Konto und den Nachweisen getrennt und ohne Anzeigenamen erhalten. Ein zu einem anderen Profil desselben Kontos übertragener, gültiger Nachweis bleibt bei einer Profilzusammenführung verknüpft.

## Lokale Abnahme

- `npm run test:i18n` prüft die bestehenden Basissprachen.
- `node tests/event-reviews-db.mjs` benötigt das Testpaket `embedded-postgres`. Eine lokale Installation lässt sich alternativ über `UHL_TEST_POSTGRES_MODULE` referenzieren. Alle Daten entstehen in einer temporären Instanz.
- `tests/browser/event-reviews-smoke.cjs` verwendet das vorhandene Release-Fixture mit `UHL_REVIEW_FIXTURE=1`. Die getestete App läuft lokal mit allen acht Sprachflags. Die bestehenden Release-Smoke-Checks sind separat ausführbar.

## Zuordnungsbestand 2026/2027

Der vollständige lesende Datenabgleich steht in `review-calendar-audit.json`. Die generierte Migration `20261212_uhl_review_calendar_assignments.sql` prüft die Kalenderdaten erneut gegen die vorbereiteten Quellfelder, bevor sie Zuordnungen einfügt. Die nachfolgende Migration übernimmt bei späteren Einzelanlagen und Importen nur eine eindeutig gleiche Reihe mit gleichem Ort, Land, Veranstalter, Veranstaltungsnamen und Quellhost, sofern für das neue Jahr noch keine Ausgabe zugeordnet ist. Geprüfte Ausnahmen lassen sich im Bewertungs-Admin gesammelt bestehenden Reihen und Veranstaltern zuordnen.

## Abnahmevorschau

`node scripts/review-acceptance.mjs` startet die Vorschau mit einer temporären PostgreSQL-Datenbank und synthetischen Konten. Der Einstieg liegt unter `http://127.0.0.1:55831/review-acceptance`. Die Schaltflächen wählen den Test-Hiker, den Test-Admin oder die Gastansicht. Die Abnahmeübersicht öffnet die bestehende Aktivitätserfassung mit freiwilliger Bewertung, die Bearbeitung einer verifizierten Teilnahme, die öffentlichen Übersichten und die Moderation. Die Moderation enthält eine offene Testbewertung und der direkte Abnahmeeinstieg meldet das Test-Adminkonto an. Ein Neustart stellt den Ausgangszustand wieder her. Der Test benötigt `embedded-postgres` oder einen Pfad zu diesem Paket in `UHL_TEST_POSTGRES_MODULE`.

Die Bewertungsfrist bleibt unbegrenzt. Eine eingereichte Überarbeitung ersetzt eine freigegebene Fassung erst nach erneuter Freigabe. Der Widerruf des Anzeigenamens wirkt sofort und gilt auch für einen offenen Entwurf. Beide Ranglisten sortieren nach ungerundetem Durchschnitt und bei gleichem Durchschnitt nach Bewertungsanzahl. Bei beiden gleichen Werten teilen Einträge den Rang. Die Anzeige innerhalb eines Gleichstands ist nach Name und Slug stabil sortiert. Der nächste unterschiedliche Eintrag erhält den nächsten fortlaufenden Rang.
