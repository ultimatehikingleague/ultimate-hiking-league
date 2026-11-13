# Activity Connect lokal prüfen

## Entwicklungsstand

Die Wanderungserfassung bietet beim Start die bevorzugte Aktion „Aktivität importieren“ und daneben „Wanderung manuell eintragen“. Im Importmodus erscheinen das bestehende Formular und seine Event-/Privat-Auswahl nach der Dateivorschau. Die Dateiauswahl ist der mobile Standard. Die Importfläche nimmt einzelne Dateien auch per Drag & Drop und bei einem vom Browser bereitgestellten Datei-Einfügeereignis an. Zum Einfügen die Fläche fokussieren. Reinen Text und Dateilinks behandelt die Fläche nicht als Datei.

In der Moderation zeigt „Importdetails anzeigen“ Dateiformat, Messwerte und Hinweise sowie den Vergleich für Datum, tatsächliche Distanz, Gesamtzeit und Aufstieg. Der Vergleich nutzt die gespeicherte Einreichung, nicht den editierbaren Admin-Entwurf. Ein bearbeiteter Wert kann daher als Abweichung erscheinen. Die Dauer wird in vollen Minuten verglichen und bei einem Dateiimport auch dann in vollen Minuten gespeichert, wenn der Nutzer Sekunden nachträgt. Das Datum wird für Import und Vergleich in Europe/Berlin ermittelt. Bei vorausgewählten Events bleibt deren vorgegebenes Datum im Formular. Ein grüner Haken bestätigt ausschließlich die Übereinstimmung.

Nach der Freigabe kann der bestehende Admin-Ablauf die Einreichungszeile mit korrigierten Werten aktualisieren. Die Vergleichsspalte zeigt dann den gespeicherten Stand. Ein revisionsfestes Abbild der vor der Prüfung eingereichten Werte wäre eine eigene Schema-Erweiterung. Die Originaldatei bleibt abrufbar.

Der private Speicher sieht keine automatische Löschung vor. Vorschlag zur Entscheidung: Originale während einer offenen Prüfung oder Nachprüfung behalten und regulär 90 Tage nach der endgültigen Entscheidung löschen. Die Dauer sollte für den vorgesehenen Nachprüfungsprozess ausreichen und vor produktiver Aktivierung abgestimmt werden.

## Aufruf mit eigener isolierter Datenbank

1. Eine lokale Supabase-Testinstanz mit dem UHL-Basisschema und seinen bestehenden Zugriffsregeln bereitstellen. Die vorhandenen Repository-Migrationen allein sind kein vollständiger Aufbau des historischen UHL-Schemas. Für den Test nur Schema und synthetische Konten bzw. Daten verwenden. Ein Testkonto benötigt ein zugeordnetes Hiker-Profil, ein zweites Konto den zugehörigen Eintrag in `admin_users`.
2. Ausschließlich in dieser lokalen Datenbank die Migration `supabase/migrations/20261112_activity_originals.sql` ausführen.
3. In einem separaten Terminal im UHL-Projekt starten. Die Schlüssel stammen aus der lokalen Supabase-Instanz. Der Service-Schlüssel bleibt serverseitig. Ein laufender Next-Entwicklungsserver im selben Checkout muss vorher beendet werden, weil Next einen gemeinsamen lokalen Entwicklungsordner sperrt.

   ```sh
   cd /Users/philippdobrinski/ultimate-hiking-league
   export NEXT_PUBLIC_ACTIVITY_IMPORT_ENABLED=true
   export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   export NEXT_PUBLIC_SUPABASE_ANON_KEY='<lokaler Anon-Schlüssel>'
   export SUPABASE_SERVICE_ROLE_KEY='<lokaler Service-Schlüssel>'
   npm run dev -- --webpack --hostname 127.0.0.1 --port 3000
   ```

4. `http://127.0.0.1:3000/account` öffnen, mit dem lokalen Testkonto anmelden und „Wanderung hinzufügen“ oder „Weitere Wanderung hinzufügen“ wählen. Bei einem vorausgewählten Event führt auch `/account/calendar` zur Erfassung. Datei importieren, einen vorausgefüllten Wert bearbeiten und einreichen.
5. In einem separaten Browserprofil mit dem lokalen Admin-Konto `http://127.0.0.1:3000/admin` öffnen. Bei der offenen Einreichung „Importdetails anzeigen“ auswählen. Vor und nach der Freigabe Profil, Rangliste und Challenge mit dafür geeigneten Testdaten prüfen.
6. Für die Rechteprüfung mit einem fremden Testkonto versuchen, die Einreichung und das Original zu lesen und direkt in den Bucket zu schreiben. Erwartet werden fehlender Lesezugriff und verweigerter Upload. Mit Eigentümer und Admin muss der geschützte Nachweisabruf funktionieren.

Der bestehende Server auf Port 3000 lief ohne die isolierte Importkonfiguration weiter. Der Modus wird beim Start des Entwicklungsservers aktiviert und setzt eine lokale Supabase-Adresse voraus. Browser-Client und Import-Endpunkt verwenden im Modus dieselbe lokale Instanz.

## Nicht aktiviert

- **Teilen aus anderen Apps.** Ein Datei-Share-Target benötigt eine installierte PWA und Browser-/OS-Unterstützung. Für einen späteren Prototyp ist Chrome auf Android geeignet. Dateifreigaben erfordern einen Multipart-POST und eine kontrollierte Übergabe an den authentifizierten Import. Safari auf iOS und Firefox unterstützen die Registrierung als Share Target laut Kompatibilitätsdaten nicht. Dort bleibt „In Dateien speichern“ und anschließend „Aktivitätsdatei auswählen“ der Weg. [Chrome-Dokumentation](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target), [Kompatibilitätsdaten](https://raw.githubusercontent.com/mdn/browser-compat-data/main/manifests/webapp/share_target.json)
- **Private Streckenvorschau.** Als erster Schritt eignet sich eine einfache SVG-Linie mit getrennten GPX-Segmenten ohne Kartenanbieter. Sie braucht eine Erweiterung des Parsers zur gezielten Koordinatenextraktion, eine getrennte authentifizierte Ausgabe mit Größenlimit und Prüfung, dass die Daten nicht gecacht oder öffentlich ausgeliefert werden. Eine Hintergrundkarte würde weitere Abhängigkeiten und Datenschutzfragen mit sich bringen. Die aktuelle Importvorschau sendet weiterhin keine vollständige GPS-Strecke.
- **Echte Freigabe- und Rechteprüfung.** Auf diesem Rechner war kein isolierter Supabase-Dienst auf dem lokalen Port erreichbar. Eine installierte Container-Laufzeit für den lokalen Supabase-Stack war nicht verfügbar. Migration, tatsächliche RLS und Storage-Regeln sowie die vollständige Freigabe mit Kontrolle von Profil, Rangliste und Challenge bleiben daher ausstehend. Produktionszugänge wurden für die Tests nicht verwendet.

## Dateiliste

- `app/components/RecordSubmissionForm.tsx` Auswahl, Importfläche und Übernahme
- `app/components/ActivityImportPreview.tsx` Gegenüberstellung in der Moderation
- `app/admin/page.tsx` Übergabe der gespeicherten Einreichung
- `app/lib/activity/compare.ts`, `app/lib/activity/normalize.ts` Vergleich und Normalisierung
- `app/lib/activity/development.ts`, `app/lib/supabase.ts`, `app/api/activity-import/route.ts` gemeinsame lokale Testkonfiguration
- `tests/activity-import.test.mts` Vergleich von Nutzereingaben und Datei

## Testergebnisse dieser Phase

| Prüfung | Ergebnis |
| --- | --- |
| Automatisierte Tests | 9 bestanden, einschließlich GPX/FIT/TCX, Dauergrenzen, Vergleich bearbeiteter Werte, Berlin-Datumswechsel und simulierter Zugriffskontrolle |
| Chrome bei 390 px | Import als Vorauswahl, manuelles Formular erreichbar, Dateiauswahl, Vorschau, bearbeitete Distanz, Speicherung als Pending und Gegenüberstellung geprüft |
| Chrome bei 1440 px | Derselbe Ablauf, zusätzlich Drag & Drop und ein Datei-Paste-Ereignis mit synthetischer Zwischenablage |
| Responsivität | Kein horizontaler Überlauf auf Seitenebene bei beiden Testbreiten. Die Vergleichstabelle scrollt bei Bedarf innerhalb ihres Containers. |
| TypeScript und ESLint | TypeScript erfolgreich. ESLint der neuen Hilfsdateien, des Endpunkts, der Vorschau und der Tests erfolgreich. |
| Testgrenze | Chrome lief mit der tatsächlichen React-Oberfläche und simulierten API-/Datenbankantworten. Es wurde kein physisches Smartphone und keine echte Datenbankfreigabe getestet. |
