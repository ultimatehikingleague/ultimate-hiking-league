# Activity Connect · Garmin-OCR

Die zwei bereitgestellten Original-PNGs wurden mit Tesseract.js 6.0.1, den lokalen Sprachmodellen Deutsch und Englisch und automatischer Seitensegmentierung ausgewertet. Die Originalbilder und vollständigen OCR-Ausgaben liegen außerhalb des Repositorys. Die TSV-Ausgaben enthalten pro erkanntem Wort Text, Koordinaten, Breite, Höhe und Tesseract-Konfidenz. Die Konfidenz ist ein interner OCR-Wert auf einer Skala bis 100.

## Befund

Positionen beziehen sich auf das Originalbild. Angaben je Zelle sind OCR-Text, linke obere Pixelposition und Konfidenz.

| Element | IMG_4017 | IMG_3978 |
| --- | --- | --- |
| Distanzzahl | `11,18` · (53, 1618) · 94,35 | `11,53` · (53, 1661) · 89,13 |
| Distanzeinheit | `«m` · (312, 1614) · 88,26 | `«m` · (327, 1701) · 86,73 |
| Distanzbeschriftung | `Distanz` · (52, 1731) · 90,03 | `Distanz` · (52, 1774) · 91,34 |
| Gesamtzeit | `4:53:18` · (51, 1855) · 81,18 | `5:07:30` · (52, 1899) · 96,34 |
| Gesamtzeitbeschriftung | `Gesamtzeit` · (51, 1930) · 89,79 | `Gesamtzeit` · (51, 1973) · 90,29 |
| Pace | `26:12` · (673, 1854) · 94,79 | `26:40` · (673, 1899) · 95,26 |
| Aufstieg | `447` · (51, 2059) · 88,04 und `m` · (192, 2083) · 82,48 | `531m` · (52, 2102) · 86,32 |
| Aufstiegsbeschriftung | `Anstieg` · (50, 2137) · 96,08 und `gesamt` · (217, 2140) · 96,16 | `Anstieg` · (50, 2180) · 91,20 und `gesamt` · (217, 2184) · 90,97 |
| Titel | `Grainau` · (51, 1397) · 92,10 und `Wandern` · (320, 1399) · 90,96 | `Garmisch-Partenkirchen` · (51, 1374) · 91,72 und `Wandern` · (50, 1466) · 92,31 |
| Datum | `25.` · (138, 1271) · 74,49 und `Juni` · (209, 1270) · 81,49 | `24.` · (138, 1271) · 36,16 und `Juni` · (209, 1270) · 36,16 |

Die Texterkennung lieferte beide Dezimalwerte, Zeitangaben und Aufstiegswerte. Bei der Einheit erkannte sie `«m` und bei der Pace fehlte der Schrägstrich. Die alte Zuordnung suchte nach der Beschriftung „Distanz“ in der folgenden Textzeile nach einem beliebigen passenden Zahlenfragment. So entstanden `12 km` und `40 km` aus den Pace-Werten. Die Gesamtzeit steht oberhalb ihrer Beschriftung. „Anstieg gesamt“ und der frei stehende, gegebenenfalls umgebrochene Titel waren bisher nicht abgedeckt.

## Korrektur

Für das erkennbare Garmin-Übersichtslayout werden die Tesseract-Wortpositionen relativ zur Texthöhe ausgewertet. Die Kennzahlen müssen unmittelbar über der passenden Beschriftung in derselben Spalte stehen. Die OCR-Verwechslung `«m` wird ausschließlich am passenden Distanzfeld mit einer expliziten Dezimalzahl als Kilometer gelesen. Unklare Werte bleiben offen. Für andere Layouts muss die allgemeine Erkennung den ganzen Zahlenausdruck einer beschrifteten Zeile erfassen. Das vollständige Datum bleibt bei beiden Originalen offen, da kein Jahr abgebildet ist. Bewegung und Abstieg bleiben ebenfalls offen. Die erkannten Werte erscheinen zur Kontrolle vor der Übernahme.

## Tests

- Beide Original-PNGs als OCR-Regression mit dem tatsächlichen Texterkenner und identischen Sprachmodellen ausgeführt.
- Beide Original-PNGs in der lokalen Chrome-Vorschau geprüft. Grainau bei 390 px, Garmisch-Partenkirchen bei 1440 px Browserbreite. Vorschau, offene Felder und Formularübernahme geprüft.
- Reproduzierbar über `node --import tsx --test tests/activity-screenshot-garmin.test.mts` mit `UHL_GARMIN_OCR_FIXTURES` als Ordner der Original-PNGs und `UHL_OCR_MODELS` als Ordner der beiden lokalen Sprachmodelle.
- Die Prüfung bezieht sich auf die gelieferten PNGs. Die früher getesteten JPEG-Fassungen waren nicht Teil dieses Regressionstests.
- Zusatztest mit auf 1.032 statt 1.290 Pixel Breite verkleinerten Kopien. Garmisch-Partenkirchen blieb vollständig. Bei Grainau blieben Distanz, Gesamtzeit und Titel korrekt. Der Aufstieg blieb offen, weil Zahl und Einheit jeweils 69,76 erzielten und damit knapp unter der Schwelle von 70 lagen. Die Schwelle wurde beibehalten.
- TypeScript und ESLint für die geänderten OCR-Dateien bestanden. Alle 16 Activity-Connect-Tests bestanden mit den Original-PNGs.
