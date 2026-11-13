# UHL Activity Connect · Vorbereitung der Veröffentlichung

## Funktionsumfang

Die vorhandenen Einreichungsformulare im Account und bei offiziellen Events verwenden denselben Import. Die Funktion wird per Umgebungsvariable freigeschaltet und beginnt mit Screenshot-OCR. GPX/FIT/TCX und die manuelle Eingabe bleiben verfügbar. OCR läuft mit mitgelieferten Tesseract-Modellen im Browser. Die Vorschau zeigt Distanz, Gesamtzeit, Aufstieg und Titel. Das Datum wird im Formular eingegeben. Ein Wechsel der Auswahl verwirft unveränderte OCR-Vorbelegungen und die bisher bestätigten Dateien. Manuell geänderte Werte bleiben beim Wechsel sichtbar. Neue erkannte Werte werden nach Bestätigung eingesetzt. Es sind bis zu vier Originaldateien möglich. Bestätigte Screenshots haben Vorrang vor später geladenen GPS-Dateien.

Die OCR-Dateien werden erst beim Einreichen direkt an Supabase Storage übertragen. Die Einreichung speichert interne Objektpfade. Der private Bucket erlaubt den Abruf mit der eigenen Anmeldung oder einer bestehenden Admin-Anmeldung. Die Moderation bietet einen authentifizierten Download. Der bisherige manuelle Nachweisweg und bereits gespeicherte Nachweise verwenden ihre bisherigen Speicherorte. Die Freigabe bleibt im vorhandenen Moderationsablauf. Wertung und Kulanzentscheidung folgen den vorhandenen Regeln.

Der Dateipfad bleibt bei einem Wiederholungsversuch stabil. Falls der Upload trotz Fehlerantwort gespeichert wurde, prüft das Formular die Bytes der vorhandenen Datei. Bei mehreren Dateien werden bereits bestätigte Uploads innerhalb desselben Formularversuchs wiederverwendet. Bei einem fehlenden Nachweis wird die Einreichung nicht angelegt. Ein eindeutiger Index schützt gegen doppelte Einreichungen mit derselben internen Referenz. Die bestehende fachliche Duplikatprüfung bleibt für neue Versuche mit neuen Referenzen zuständig. Private Dateien können bei Abbruch nach Teilupload oder nach einem endgültig fehlgeschlagenen Eintrag ohne zugehörige Einreichung verbleiben. Es gibt keine automatische Löschung.

## Prüfungen

- Die isolierte Chrome-Vorschau wurde bei 390 und 1440 Pixel Browserbreite geprüft. Synthetische Screenshots durchliefen die echte Browser-OCR. Getestet wurden Mehrfachauswahl, widersprüchliche Werte, Entfernen, Austausch, manuelles Datum trotz erkanntem Datum, Vorrang vor GPX und Zurückweisung eines vorgetäuschten PNG. Die Vorschau erlaubt keine Datenbankeinreichungen.
- 16 Activity-Connect-Tests erfolgreich. Der Test mit den beiden privaten Garmin-Originalen wurde in dieser Runde übersprungen, weil die Dateien am bisherigen Desktop-Pfad fehlen. Die OCR-Zuordnung wurde seit dem letzten erfolgreichen Test nicht geändert. Markt Erlbach wurde vom Auftraggeber lokal geprüft.
- Die Migration für Screenshot-Nachweise wurde in isoliertem PostgreSQL auf einem nachgebildeten Storage-Schema mit absichtlich großzügiger Altregel ausgeführt. Eigentümer und Admin durften lesen. Dritte und anonyme Rollen erhielten keinen Zugriff. Aktualisieren und Löschen der neuen Originale waren gesperrt. Die bisherige Speicherregel und die Eindeutigkeit der Einreichungsreferenz wurden geprüft.
- Der lokale Produktions-Build wurde mit aktivierter Importfunktion und einer Loopback-Testkonfiguration geprüft. Die geänderten Importmodule und das Einreichungsformular wurden mit TypeScript und ESLint geprüft. Die Admin-Seite enthält bereits bestehende ESLint-Befunde.
- Offen bleibt der Durchlauf mit echtem Supabase Auth, Storage und dem vollständigen UHL-Schema. Die Arbeitsumgebung stellt keinen isolierten Supabase-Stack bereit. Zu prüfen sind tatsächlicher Uploadfehler und Wiederholung, Originaldownload mit getrennten Benutzerrollen, Admin-Ablehnung, Admin-Freigabe, fachliche Dublettenprüfung und Ranking-Aktualisierung. Das isolierte PostgreSQL-Modell ersetzt diese Prüfung nicht.

## Rollout nach Freigabe

1. Einen isolierten Supabase-Stack mit dem relevanten UHL-Schema bereitstellen. Beide Migrationen zuerst dort anwenden und den oben beschriebenen Durchlauf mit separatem Nutzer, Admin und fremdem Konto prüfen.
2. Die Migrationen `20261112_activity_originals.sql` für GPS und `20261113_activity_screenshot_proofs.sql` für Screenshots im Zielprojekt prüfen. Falls die GPS-Migration bereits eingetragen ist, ihren Stand verifizieren und sie nicht erneut ausführen. Die neuen Buckets auf privaten Zugriff kontrollieren.
3. Im Ziel-Deployment `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` auf genau das bestehende UHL-Projekt setzen. GPS benötigt außerdem `SUPABASE_SERVICE_ROLE_KEY` ausschließlich auf dem Server. `NEXT_PUBLIC_ACTIVITY_IMPORT_ENABLED=true` beim Build setzen. Der Build muss über `npm run build` laufen, damit `prebuild` die OCR-Dateien kopiert. Die Dateien unter `/activity-ocr/` vor der Freigabe auf Erreichbarkeit prüfen.
4. Den bestehenden Vercel-Releaseprozess verwenden. Für eine Rücknahme die Funktion beim nächsten Build deaktivieren. Die privaten Screenshot-Nachweise bleiben mit dieser Version im Adminbereich abrufbar. Für die GPS-Originalansicht muss die GPS-Route verfügbar sein.

## Betroffene Dateien

- `app/components/ActivityScreenshotImport.tsx` und `app/components/RecordSubmissionForm.tsx`
- `app/components/PrivateScreenshotProof.tsx` und `app/admin/page.tsx`
- `app/lib/activity/screenshot-proof.ts` und `supabase/migrations/20261113_activity_screenshot_proofs.sql`
- `app/lib/supabase.ts`, `app/api/activity-import/route.ts` und `package.json`
- `tests/activity-screenshot.test.mts`

## Garmin-Release · letzter lokaler Stand

- Browser-Vorschau unter `http://localhost:3000/account?garminPreview=1`. Der Server rendert dort das reguläre Einreichungsformular separat vom angemeldeten Account. Der Modus setzt Next.js-Entwicklung und einen Loopback-Host voraus. Einreichen und GPS sind dort gesperrt. `node scripts/prepare-activity-ocr.mjs` stellt die lokalen OCR-Dateien für den Entwicklungsserver bereit.
- Garmin-Release mit `NEXT_PUBLIC_ACTIVITY_IMPORT_ENABLED=true` und `NEXT_PUBLIC_ACTIVITY_GPS_ENABLED=false` bauen. GPS-POST und -PUT sind damit serverseitig aus. Bestehende private GPS-Originale bleiben über den authentifizierten Leseweg erreichbar, wenn dessen Konfiguration aktiv ist.
- Für Garmin gilt die geometrische Zuordnung. Bei fehlenden Kennzahlen prüft Tesseract mit einer zweiten Seitensegmentierung. Widersprüche bleiben offen. Die Anwendung enthält keine hinterlegten Referenzwerte.
- Wiederholbare Originaltests: `UHL_GARMIN_OCR_FIXTURES` auf den Ordner mit `IMG_4017.PNG` und `IMG_3978.PNG` setzen, `UHL_GARMIN_MARKT_SCREENSHOT` auf die Originaldatei für Markt Erlbach und `UHL_OCR_MODELS=public/activity-ocr`. Danach `node --import tsx --test tests/activity-screenshot-garmin.test.mts`. Jeder Fall läuft zweimal.
- Die Screenshot-Migration trägt jetzt die eigene Version `20261113`. Für einen frischen Garmin-only-Release wird ausschließlich die Screenshot-Migration benötigt. Die GPS-Migration bleibt für die spätere Aktivierung unter `20261112` erhalten. Vor Anwendung den Migrationsverlauf mit den vorhandenen Buckets, Policies und Indizes abgleichen, falls eine Datei bereits manuell ausgeführt wurde.

### Abnahme in einem isolierten Supabase-Projekt

1. Eine Testinstanz mit UHL-Schema, bestehendem RLS, künstlichem Hiker und drei getrennten Anmeldungen bereitstellen: Eigentümer, zweiter Nutzer und vorhandene Admin-Rolle. Die lokale App mit deren URL und öffentlichem Schlüssel konfigurieren. Für einen Entwicklungsserver mit Loopback die Importfreigabe setzen. Bei einer externen Testinstanz einen lokalen Produktions-Build mit der Testkonfiguration verwenden.
2. Screenshot auswählen, Werte bestätigen und Datum ergänzen. Vor dem Absenden darf kein Storage-Objekt vorhanden sein. Nach Absenden Originalbytes, interne Referenz und Status `pending` prüfen. Bei einem unterbrochenen zweiten Upload prüfen, dass kein unvollständiger Datensatz entsteht und der erneute Versuch dieselbe Referenz verwendet.
3. Originalabruf durch Eigentümer und über die Admin-Oberfläche prüfen. Mit dem zweiten Nutzer sowie ohne Sitzung denselben Objektpfad testen. Beide Abrufe müssen abgewiesen werden.
4. Eine Testeinreichung ablehnen und prüfen, dass kein Record entsteht. Eine andere freigeben und prüfen, dass genau ein Record und die erwartete Ranking-Aktualisierung entstehen. Einen erneuten identischen Einreichungsversuch anhand der bestehenden Dublettenregeln prüfen.
5. Erst nach bestandener Abnahme und gesonderter Freigabe die Screenshot-Migration im Zielprojekt anwenden. Danach über den bestehenden Releaseprozess ausrollen und die Erreichbarkeit der lokalen OCR-Dateien im Deployment prüfen.
