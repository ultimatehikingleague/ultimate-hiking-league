# Bilder der ULTIMATE-Startseite am 07.11.2026

Die Bildoptimierung wurde auf der öffentlichen Startseite veröffentlicht. Der Vercel-Kandidat `dpl_DwbD5YcLudhK49NEjc72Nf3rAjJb` ging aus `dpl_BncuaV8UZRr1dZEVUiAmw1v4zZkb` hervor. Die Prüfung der hochgeladenen Dateihashes bestätigt den Umfang von `app/page.tsx` und drei Bilddateien. [Geprüfter Releaseumfang](home-image-release-scope.json)

| Motiv | Auflösung | Vorher | Nachher | Ersparnis |
|---|---:|---:|---:|---:|
| Hero | 1.024 × 1.536 | JPEG 1.272.589 B | AVIF 186.491 B | 85,3 % |
| Hero bei WebP-Auswahl | 1.024 × 1.536 | JPEG 1.272.589 B | WebP 338.780 B | 73,4 % |
| Weihnachtschallenge | 1.983 × 793 | PNG 2.534.575 B | WebP 641.218 B | 74,7 % |
| Hero und Challenge in Chrome | | 3.807.164 B | 827.709 B | 78,3 % |

AVIF und WebP wurden mit Sharp aus den Originaldateien in voller Auflösung erzeugt. Die visuell geprüfte AVIF-Variante verwendet Qualität 87 und 4:4:4-Farbabtastung. WebP verwendet Qualität 97. Das Hero-Markup liefert über `picture` AVIF, WebP oder das ursprüngliche JPEG. Das Hero lädt unmittelbar mit hoher Priorität. Der Challenge-Hintergrund behält seine CSS-Positionierung und Verläufe. Partnerbilder erhalten natives Lazy Loading. Die Laufzeitstichprobe enthielt keine gebuchten Partnerbilder, deren verzögertes Laden sich beobachten ließ.

Das bestehende Shop-Symbol nutzt weiterhin Next.js Image mit viewportabhängigen Größen und dessen Lazy Loading. Der Browser lud dafür 28.854 Byte am Desktop und 56.174 Byte mobil. Das Logo lud jeweils 42.989 Byte. Die neuen Hauptbilder sind statische Assets auf dem bestehenden Hosting. Diese Wahl spart laufende Bildtransformationen für die neuen Dateien. [Next.js Image](https://nextjs.org/docs/app/api-reference/components/image) · [Vercel-Bildoptimierung](https://vercel.com/docs/image-optimization)

Verglichen wurden Desktop bei 1.440 × 900 und Mobil bei 390 × 844 mit DPR 2. Im Bildvergleich nach Schließen des Cookie-Dialogs blieben Zuschnitt, Abmessungen und Layout gleich. Der mittlere absolute Farbkanalunterschied im Hero-Screenshot lag bei 0,33 beziehungsweise 0,34 von 255 Stufen. In der Sichtprüfung fiel kein Qualitätsverlust auf. Die Kompression ist technisch verlustbehaftet.

| Produktionsmessung | Desktop vorher → nachher | Mobil vorher → nachher |
|---|---:|---:|
| Bildtransfer für Hero, Challenge, Logo und Shop-Symbol | 3,88 → 0,90 MB | 3,91 → 0,93 MB |
| Hero-Anfragedauer, Median | 2,62 → 0,45 s | 2,28 → 0,56 s |
| Largest Contentful Paint, Median | 4,89 → 2,18 s | 2,84 → 1,90 s |

Zwei Chrome-Abrufe pro Phase und Ansicht mit deaktiviertem Browsercache, 10 Mbit/s und 40 ms simulierter Latenz. Desktop-LCP war das Hero, mobil das Logo. Die Stichprobe beschreibt dieses Testsetup. Serverzeit, Verbindung und Zeitpunkt des Cookie-Dialogs variierten. Ein Desktop-Abruf meldete vor dem Schließen des Dialogs eine 15 px breite Scrollbar. [Messdaten](home-image-measurements.json)

TypeScript und die Produktions-Builds waren erfolgreich. ESLint meldete drei bestehende Hinweise für native Bild-Tags und keine Fehler. Von 37 Tests bestanden 36, ein Test benötigt eine konfigurierte isolierte PostgreSQL-Datenbank. Die Live-Ressourcen lieferten die erwarteten Formate und Bytezahlen. Shop, Ranking und Login antworteten mit 200. Der Shop-Job verweigerte den Aufruf ohne Berechtigung mit 401, die Statusjob-Route antwortete mit 404.

Der Rückweg für diese Änderung ist das vorherige Vercel-Deployment. Sobald weitere Änderungen auf dem Bildrelease aufbauen, müssen diese bei der Auswahl des Rückwegs berücksichtigt werden.
