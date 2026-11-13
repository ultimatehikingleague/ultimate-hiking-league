# Activity Connect – lokaler Screenshot-Prototyp

Die Browser-OCR verwendet Tesseract.js 6.0.1 mit deutschen und englischen Sprachmodellen. Worker, WebAssembly und Modelle werden vom lokalen App-Server geladen. Das Bild wird dem Worker als ursprüngliches File übergeben. Es wird zur Erkennung weder an eine API gesendet noch neu gespeichert oder komprimiert.

Zum Vorbereiten der OCR-Dateien im Entwicklungsprojekt nach der Installation der Abhängigkeiten `node scripts/prepare-activity-ocr.mjs` ausführen. Für die isolierte Vorschau kann das öffentliche Verzeichnis der Vorschau als Argument übergeben werden. Die OCR-Assets werden lokal erzeugt und sind von Git ausgenommen.

## Erfassung und Nachweise

- Der Screenshot-Modus ist die bevorzugte Auswahl. Bis zu vier PNG-, JPEG- oder WebP-Dateien sind möglich.
- Eindeutig zugeordnete Werte werden zur Kontrolle angeboten. Bei Widersprüchen bleibt das Feld offen. Eine generische Beschriftung wie „Dauer“ reicht für Gesamtzeit nicht aus. Sekunden werden abgeschnitten.
- Nach Bestätigung übernimmt das vorhandene Formular die passenden Werte. Abstieg und Bewegungszeit erscheinen in der Vorschau. Für sie gibt es im bestehenden Formular keine eigenen Felder.
- Dieselben File-Objekte gehen beim Absenden über die vorhandene Upload-Funktion in den bisherigen Nachweisspeicher. Ein einzelnes Bild behält das bestehende Referenzformat. Bei mehreren Bildern enthält das bestehende Nachweisfeld eine Liste, die die Moderation als einzelne Links öffnet. Es wurde keine Migration angelegt. Die Zugriffseigenschaften des bisherigen Nachweisspeichers gelten weiterhin. Vor einem produktiven Einsatz ist die Speicherung und Anzeige mit einer isolierten Datenbank zu testen.
- Eine zusätzlich geladene GPS-Datei dient im Screenshot-Modus zum Vergleich. Die Screenshot-Nachweise werden eingereicht, und bestätigte oder nachträglich bearbeitete Formularwerte bleiben erhalten. Der eigenständige GPS-Import verwendet weiterhin den privaten Originaldatei-Ablauf.
- Die lokale Vorschau bietet Datei, OCR, Bestätigung und Formular an. Absenden ist dort deaktiviert. Die bestehende Moderation bleibt für eine Einreichung erforderlich.

## Erkennungsqualität

- Chrome-Browsertest mit gerendertem Testbild und bekannten Sollwerten. Die OCR erkannte Distanz, Auf- und Abstieg, Datum, Gesamtzeit, Bewegungszeit und den beschrifteten Titel. Die Dateien wurden als zwei Nachweise übernommen. Ein späterer GPX-Import überschrieb die bestätigten Werte nicht. Der Browser meldete dabei keine externen Netzwerkanfragen.
- Ein Parser-Test mit den transkribierten Outdooractive-Beschriftungen aus Wiesenttal ergab 14,2 km, 590 m Aufstieg, 587 m Abstieg, 05:33 Gesamtzeit und 02:48 Bewegungszeit. Dieser Test misst die Zuordnung der OCR-Ausgabe, nicht die Zeichenerkennung der Originalbilder.
- Eine Messung mit den Original-Screenshotdateien von Outdooractive, Garmin Connect und Komoot steht noch aus. Layouts ohne eindeutige Beschriftungen, abgeschnittene Angaben und widersprüchliche Zahlen erfordern manuelle Kontrolle.
