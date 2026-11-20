# UHL DE/EN · Abschlussprüfung und Releasekandidat

Stand 16. November 2026. Beide Live-Domains wurden erneut dem Vercel-Deployment `dpl_4rEFDaQ4d87E9vdwuQvbM5QiA66o` zugeordnet. Der lokale Kandidat baut auf dessen Quellstand auf. Es wurde kein Deployment bei Vercel angelegt oder umgeschaltet.

## Sprachwahl und Authentifizierung

- Ein Host-Cookie funktioniert für Navigation, Reload und erneuten Besuch auf demselben Host. Die Browserprobe mit `localhost` und `127.0.0.1` zeigte gleichzeitig Deutsch auf dem ersten und Englisch auf dem zweiten Host. Dieses Verhalten gilt auch für die beiden unterschiedlichen registrierbaren UHL-Domains.
- Google-Anmeldung und Passwort-Reset kehren weiterhin über die bestehenden festen Adressen zur Hauptdomain zurück. Bei einem Domainwechsel gilt die dort gespeicherte Sprache oder die Browsererkennung. Die abweichende manuelle Auswahl auf der Ausgangsdomain wird nicht übertragen.
- Mit den bestehenden Rücksprüngen erhält die Zieldomain kein Signal über die Wahl auf der Ausgangsdomain. Ein Cookie kann nicht für beide registrierbaren Domains gesetzt werden. Ein Hintergrundabruf über die andere Domain wäre von Third-Party-Cookie-Regeln abhängig. Eine explizite zusätzliche Navigation könnte nur einen validierten Sprachcode weitergeben, wäre aber ein neuer Bedienweg und löst bestehende Reset-Rücksprünge nicht allgemein. Daher bleibt die Wahl in diesem Release pro Domain.
- Login- und Reset-Quellen, Middleware, Provider- und Auth-Konfiguration sowie sämtliche API-Pfade wurden unverändert gelassen. Die beiden Einstiegsseiten und der Zustand „ungültiger oder unvollständiger Wiederherstellungslink“ wurden im lokalen Build geprüft. Google-Provider und Reset-Mailversand wurden nicht ausgelöst. Es gibt keine neue Datenbankstruktur, domainübergreifende Tokenübergabe oder Weiterleitung.

## Sprachmenü und Funktionstests

Der kompakte Schalter sitzt im vorhandenen Navigationsbereich der Startseite und der Shop-Seiten, die diese Navigation verwenden. Auf Seiten ohne diese Navigation sitzt er rechts oben im vorhandenen Seitenrahmen. Er fügt keine separate Leiste hinzu. Das dunkel gestaltete Menü zeigt Flagge und ausgeschriebenen Sprachnamen, außerdem „Browsersprache“ mit Globus und eine Markierung der aktiven Auswahl. Flaggen dienen der Orientierung. Der Sprachwert bleibt `de` oder `en`. Die Optionen entstehen aus der vorhandenen Liste unterstützter Sprachen und ihren Anzeigedaten.

- In Chrome bei 1.601, 390 und 320 Pixeln geprüft. Das Dropdown blieb im Ansichtsbereich. Enter öffnete es, Escape schloss es und setzte den Fokus auf den Auslöser. Die Startseite behielt Hero-Motiv, Logo und den Slogan „Show us who you are.“. Die Begleitzeile wechselte regulär mit der Sprache.
- Vorhandene Navigation und beide Ranking-Sprachen geprüft. Auf der Gesamtrangliste blieb der eingegebene Suchbegriff nach dem Sprachwechsel erhalten. Die Startseitenprobe behielt Query und URL-Fragment. Manuelle Auswahl und Reload wurden im Produktionsbuild geprüft.
- Vier automatisierte i18n-Tests bestanden. 48 Kombinationen aus Host, Route, Cookie und Browserheader wurden sowohl als HTML als auch als React-Server-Component-Antwort geprüft. Dazu gehören Deutsch, Englisch, Englisch-Fallback und Vorrang des gültigen manuellen Cookies. Zwölf Bestandsrouten wurden gegen den Basisbuild auf Status und Weiterleitungsziel verglichen. Gesperrte Routen und die Admin-API behielten ihre Antworten. Build mit Produktionsoptimierung und TypeScript bestanden.

## Performance und Cache

Zwei lokale, optimierte Builds aus dem Live-Quellstand und dem Kandidaten verwendeten dieselben isolierten Daten. Die Tabelle zeigt den Median aus sieben GET-Aufrufen je Seite und Build nach Aufwärmen. Die JavaScript-Werte sind die Summe der Größe der im HTML referenzierten Next-Skripte, jeweils mit demselben gzip-Verfahren gemessen. Sie stehen für einen ersten Aufruf ohne Asset-Cache.

| Strecke | Lokales TTFB Basis → Kandidat | Lokale HTML-Antwort vollständig | JavaScript gzip | Skripte im HTML |
| --- | ---: | ---: | ---: | ---: |
| Startseite | 8,4 → 9,2 ms | 9,6 → 10,6 ms | 235,0 → 247,8 KiB | 11 → 13 |
| Ranking-Hub | 3,2 → 3,7 ms | 3,9 → 4,7 ms | 234,0 → 252,0 KiB | 11 → 14 |
| Gesamtrangliste | 0,7 → 2,6 ms | 0,8 → 3,3 ms | 235,8 → 253,4 KiB | 11 → 14 |
| Division Gold | 0,7 → 2,8 ms | 0,8 → 3,5 ms | 235,7 → 253,3 KiB | 11 → 14 |
| Outdoor Store | 0,8 → 2,8 ms | 1,0 → 3,7 ms | 227,2 → 249,1 KiB | 10 → 14 |

Drei Lighthouse-Aufrufe der lokalen Startseite je Build mit Mobilprofil, ohne simulierte Drosselung, ergaben für den Largest Contentful Paint im Median **297 → 153 ms**. Die Einzelwerte streuten von 146 bis 795 ms in der Basis und von 133 bis 537 ms im Kandidaten. Daraus lässt sich keine schnellere Produktionsseite ableiten. Lighthouse zählte **50 → 39 Anfragen**, darunter **23 → 14** Next-Navigationsvorabrufe. Im initialen HTML sind trotzdem zusätzliche JavaScript-Dateien für die Sprachoberfläche referenziert. Die übersetzten Inhalte erzeugen keine Anfrage an einen Übersetzungsdienst. Die manuelle Wahl wird über eine Server Action auf der aktuellen Seite gespeichert.

Die direkte WWW-Live-Stichprobe (Median aus drei Public-GETs) ergab **2.267 ms** bis zum ersten Byte auf der Startseite, **97 ms** auf der Gesamtrangliste und **85 ms** im Store. Die zugehörige JavaScript-gzip-Größe lag bei **242,5**, **243,2** und **236,8 KiB**. Die Live-Startseite war ein Vercel-Cache-Miss. Gesamtrangliste und Store kamen aus dem CDN-Cache. Die zweite Domain lieferte in einer zusätzlichen Stichprobe dieselbe Cache-Klassifizierung für die dynamische Startseite und vorgerenderte Antworten für Ranking und Store. Live-Zeiten und lokale Zeiten sind wegen Netzwerk, CDN und Datenquelle nicht direkt vergleichbar.

Die Kandidatenantworten für personalisiertes HTML und React Server Components enthielten `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`. In der Testmatrix gab es keine Vermischung zwischen Deutsch und Englisch. Gehashte JS- und CSS-Artefakte bleiben öffentlich und langfristig cachebar. Der wichtigste Nachteil ist der wegfallende gemeinsame CDN-Cache für bisher statische HTML-Seiten wie Gesamtrangliste, Divisionen und Store. Der reale Effekt auf Serverzeit und Plattformlast ist erst auf Vercel messbar.

## SEO und Releaseempfehlung

Die bestehenden URLs, Sitemap-Pfade und der konfigurierte `metadataBase` bleiben erhalten. Der Kandidat liefert korrektes `html lang` und eine lokalisierte Standardbeschreibung. Die sprachadaptiven URLs können von Suchmaschinen in ihrer Standardsprache gecrawlt werden. Für gezielte englische Indexierung sind später stabile Sprach-URLs und reziproke `hreflang`-Paare erforderlich. Diese sind nicht Bestandteil des Kandidaten. [Google Search Central zu sprachadaptiven Seiten](https://developers.google.com/search/docs/specialty/international/locale-adaptive-pages)

**Empfehlung:** Für die kontrollierte Freigabe als DE/EN-Pilot geeignet, mit separater Sprachwahl je Domain. Nach ausdrücklicher Freigabe zuerst einen Vercel-Kandidaten ohne Domain-Umschaltung prüfen. Darauf die realen TTFB- und Cache-Header für Startseite, Ranking und Store erfassen. Anschließend den gemeinsamen Release-Prozess ausführen und beide Aliase prüfen. Bei einem geänderten Live-Basisstand den Kandidaten darauf neu aufsetzen.

Das lokale Quellpaket `output/UHL-DE-EN-Phase-2-Releasekandidat.tar.gz` enthält 30 neu hinzugefügte oder geänderte Dateien und das Prüfsummenmanifest des verifizierten Live-Basisstands. SHA-256 des Pakets `ffc5cce47c0c5896519bd30a4e2b23010c1bc367986863d0394b7518230432de`. Garmin-Quellen, Aktivitätsimporte, Auth-Seiten, APIs, Migrationen, Build-Ausgaben und Zugangsdaten sind nicht Teil des Pakets. Die Vorbereitung benötigt keine SQL-Migration.
