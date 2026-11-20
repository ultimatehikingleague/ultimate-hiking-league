# UHL Internationalisierung · Phase 3

## Ziel und Umfang

Deutsch (`de`) und Englisch (`en`) sind produktiv. Phase 3 plant zwölf weitere Sprachen und damit insgesamt 14 Sprachfassungen. Die Planung baut auf dem veröffentlichten DE/EN-Stand mit iPhone-Hotfix (`dpl_BJYhzHwNMiDYN5d8gvpVqWocMmPX`) auf. Die UHL betreibt weiterhin dieselbe Anwendung, dieselbe Datenbank und beide bestehenden Domains.

| Sprache | Code und Beispielroute | Gezielte Abnahme |
| --- | --- | --- |
| Französisch | `fr` · `/fr/rules` | Längere Texte, typografische Leerzeichen und französische Fachbegriffe |
| Italienisch | `it` · `/it/rules` | Textumbruch, Datums- und Zahlenanzeige |
| Spanisch | `es` · `/es/rules` | Akzente, Sonderzeichen in Suche und Formularen, allgemeines Spanisch |
| Niederländisch | `nl` · `/nl/rules` | Lange Komposita, Menü und Tabellen |
| Polnisch | `pl` · `/pl/rules` | Diakritika und ICU-Pluralformen |
| Tschechisch | `cs` · `/cs/rules` | Diakritika, Pluralformen und Dezimalwerte |
| Portugiesisch | `pt` · `/pt/rules` | Europäisches Portugiesisch als redaktionelle Fassung, URL und hreflang `pt` |
| Dänisch | `da` · `/da/rules` | æ, ø, å sowie Datum und Zahlen |
| Finnisch | `fi` · `/fi/rules` | Lange Komposita, flexible Tabellen und Eventfilter |
| Schwedisch | `sv` · `/sv/rules` | å, ä, ö, Kalendertexte und schmale Menüs |
| Ukrainisch | `uk` · `/uk/rules` | Кирилиця, Ґ/Є/І/Ї, Apostroph, ICU-Pluralformen |
| Russisch | `ru` · `/ru/rules` | Кириллица, Ё/ё, ICU-Pluralformen |

Finnland und Schweden sind wegen der bestehenden Events relevant. Ukrainisch und Russisch berücksichtigen den vorhandenen Nutzerbezug. Belgien ist für diesen Ausbau über `fr`, `nl` und `de` sprachlich abgedeckt. Für Luxemburg sind `de` und `fr` als erster Schritt vorgesehen. Luxemburgisch (`lb`) bleibt eine mögliche spätere Erweiterung. Die Sprache dient der Darstellung. Lieferland, Währung, Teilnahmevoraussetzungen und rechtliche Zuständigkeit folgen weiterhin den bestehenden Geschäftsregeln. [Belgische Bundesregierung](https://www.belgium.be/en/about_belgium/government/federale_staat) · [Sprachen in Luxemburg](https://luxembourg.public.lu/en/society-and-culture/languages/languages-spoken-luxembourg.html)

## Technische Machbarkeit

Alle zwölf Sprachen passen in den bestehenden Next.js-App-Router mit `next-intl`, versionierten JSON-Katalogen und der vorhandenen Sprachauswahl. Im lokalen Node-Lauf unterstützte `Intl.PluralRules` alle zwölf Codes. Das belegt die Laufzeitunterstützung im geprüften Node-System. Zielbrowser, Fonts und Vercel-Build folgen in der isolierten Abnahme.

- **Sprachregister.** Heute sind `i18n/locales.ts`, der Katalogimport in `i18n/request.ts`, die Sprachdaten im Menü, der Rewrite in `next.config.ts` und Canonical-/Alternativlinks auf DE/EN zugeschnitten. Ein typisiertes Register soll Code, Eigenbezeichnung, Darstellungs-Locale, expliziten Katalogimport und Freigabestatus liefern. Eine Route-Liste bleibt die Quelle für präfixierbare Pfade. Vorschau und Produktion verwenden getrennte Freigabelisten. Unfertige Sprachen erscheinen weder in der produktiven Auswahl noch in Metadaten.
- **Routen.** Bestehende `/de`- und `/en`-Auslieferung als Referenz einfrieren. Im Prototyp für neue Codes einen gemeinsamen, validierten Routeneinstieg mit den vorhandenen Seitenmodulen prüfen. Ein generisches Segment darf keine Altroute, numerisches Hikerprofil, unbekannte Sprache oder gesperrte Route übernehmen. Bestehende Slugs, URLs, API-Pfade, Middleware-Schutz und Rücksprünge beibehalten. Eine Änderung der DE/EN-Routen ist für Phase 3 nicht erforderlich. [next-intl Routing](https://next-intl.dev/docs/routing/setup)
- **Präferenz.** Auf expliziten Sprach-URLs entscheidet der Pfad über die Darstellung. Ohne Präfix gilt manuelle Wahl vor Login-Sprachkontext, Browserpriorität und englischem Fallback. Browser-Locale wie `fi-FI` und `uk-UA` auf den freigegebenen Sprachcode auflösen. Query und Fragment erhalten. Login und Reset behalten ihre Adressen. Hostgebundene Präferenzen sind bei einem Domainwechsel nur verfügbar, wenn sie am Zielhost bereits gesetzt wurden.
- **Client und Formatierung.** Weiterhin einen Katalog pro Anfrage laden und nur globale UI-Texte und die benötigten Komponentenbereiche übertragen. Der veröffentlichte Stand hat 1.266 Textschlüssel je Sprache in 42 Bereichen, davon 197 im globalen Bereich `ui`. Konto, Events und Shops enthalten teils feste deutsche oder deutsch-englische Formatierung. Zahlen, Daten, Länderbezeichnungen und Plurale je Sprache an der Darstellungsgrenze vereinheitlichen. DE/EN-Ausgaben, Zeitzonen, Preise, Grenzwerte und maschinenlesbare Daten bleiben stabil. Bei Eventfiltern Datumseingabe und Anzeige vorab trennen, sofern die Anzeige heute zurückgeparst wird.
- **Mobile und Kyrillisch.** Ein begrenzt hohes, scrollbares Menü mit Eigenbezeichnungen und sichtbarer Auswahl vorsehen. Die geprüften 44-Pixel-Tippflächen, Fokusführung, Escape und WebKit-Verhalten beibehalten. Für `uk` und `ru` lateinische und kyrillische Zeichen in derselben Ansicht auf Abdeckung, konsistente Fallback-Schriften, Schriftgewicht, Umbruch und zusätzliche Font-Requests prüfen. Eine Erweiterung des Font-Subsets kommt nur bei nachgewiesenen Lücken infrage.

## Übersetzung und Aufwand

Pro Sprache rund 1.266 Einträge als Ausgangspunkt, für zwölf Sprachen **15.192 Schlüssel-Sprach-Paare** vor zusätzlichen Bestandslücken. Das ist eine Mengenbasis für Planung und Abnahme. Wiederholte Kurzlabels, ICU-Formen und lange Regel- und Rechtstexte haben unterschiedlichen Aufwand. Zuerst mit einem Paket aus Navigation, Konto-Fehlern und einem langen Regelabschnitt die tatsächliche Bearbeitungs- und Reviewdauer messen. Erst danach je Sprache Aufwand für Entwurf, Sprachreview, fachlichen Vergleich und Browserprüfung schätzen.

1. **Inventar einfrieren.** Kataloge, fest codierte UI-Texte und relevante Zustände mit Quelle, Kontext und Prüfer erfassen. Navigation, Startseite, Regeln, FAQ, Rankings, Events, Profile, Konto, Garmin-Anzeigen, Aktivitätsformulare, Challenges, Shops, Authentifizierungsoberflächen, Footer und Rechtstexte sind im Umfang.
2. **Übersetzen.** Versionierte Kataloge, gemeinsames Glossar und geschützte Begriffe verwenden. „Show us who you are.“, Logos, Marken, Eigennamen, Nutzerinhalte und Veranstalterbeschreibungen bleiben im Original. Ligaregeln auf Zahlen, Grenzwerte und Aussagen abgleichen. Rechtstexte konsistent übertragen und offene Fragen für die gesonderte Prüfung nach der Sprachveröffentlichung dokumentieren. Keine neuen Zusagen oder länderspezifischen Regeln einführen.
3. **Angemeldete Zustände abnehmen.** Konto, Profilverwaltung und Einstellungen, Aktivitätsimport, Garmin-Status, Meldungen, Berechtigungs- und Leerzustände, Milestones, Einlösung sowie Bestell- und Formularzustände mit isolierten Fixtures prüfen. Vorhandene API-Fehler an der Anzeige über stabile Meldungsschlüssel zuordnen. Provider-E-Mails, vorhandene Vertragsbelege und externe Zahlungsoberflächen separat im Inventar ausweisen. Bestehende Backend- und Versandabläufe bleiben erhalten.

## SEO, CDN und Teststrategie

- Je vollständig abgenommener öffentlicher Seite eigener Canonical auf `www.ultimatehikingleague.com`. Die zweite Domain bleibt erreichbar und verweist auf denselben sprachgleichen Canonical. Gegenseitige `hreflang`-Einträge einschließlich Selbstreferenz und bestehendem englischem `x-default` nur für erreichbare freigegebene Varianten. Sitemap und interne Links daran ausrichten. Vorschau schützen und von der Indexierung ausschließen. [Google Search Central](https://developers.google.com/search/docs/specialty/international/localized-versions)
- Für Regeln und FAQ pro Sprache HTML und GET-RSC auf beiden Domains mit widersprechenden Cookies und Browser-Headern messen. Cache-HIT/MISS, Sprachtrennung, `Vary`, `Set-Cookie`, Antwortgröße, Buildzeit und TTFB mit der DE/EN-Basis vergleichen. Sitzung, Konto, Admin, Login, Reset, Checkout, Bestellstatus und personenbezogene Antworten behalten private Cache-Regeln. Keine breitere Cache-Freigabe im Sprachrollout.
- Pro Katalog Schlüsselgleichheit, leere Werte, ICU-Platzhalter und Rich-Text-Tags prüfen. Pluralfälle in `pl`, `cs`, `uk` und `ru` unter anderem mit 0, 1, 2, 5, 11, 21, 22 und Dezimalzahlen abnehmen. Verdächtige DE/EN-Reste per Scan markieren und im Kontext prüfen. Für Marken und erlaubte Originalinhalte eine kontrollierte Ausnahmeliste verwenden.
- Pro Sprache WebKit mit iPhone-Touch bei 320 und 390 CSS-Pixeln und Desktop-Browser prüfen. Auswahl, Wiederbesuch, Rückkehr zur Browsersprache, Query und Fragment, Navigation, Login-Sprachkontext, Reset-Rücksprung und fehlende Redirect-Schleifen testen. Reales iPhone für die Abnahme des erweiterten Menüs und beider Schriften einplanen. Testkonten und Fixtures isoliert verwenden. Die vollständige bisherige DE/EN-Matrix je Veröffentlichungswelle als Regressionstest ausführen.

## Wiederholbarer Ausbau und Freigabereihenfolge

1. Technischer Prototyp in einer geschützten Vorschau mit repräsentativen Ausschnitten in `fr`, `pl`, `fi` und `uk` für Textlänge, Plural, Komposita und kyrillische Darstellung. Anwendungsrouten und Betriebswerte messen.
2. Kataloge für alle zwölf Sprachen vorbereiten. Je Sprache denselben Ablauf verwenden: Registereintrag, Katalog, Fachglossar und Review, automatisierte Prüfungen, visuelle Abnahme, isolierter Kontotest, SEO-/Cache-Matrix, Freigabeprotokoll.
3. Spätere Veröffentlichungsreihenfolge als Vorschlag: zuerst `fr` und `nl` für den ersten kleinen Rollout, dann `fi`, `sv`, `da` wegen der nordischen Eventanbindung, danach `it`, `es`, `pt`, `pl`, `cs` in zwei Teilwellen. `uk` und `ru` nach bestandener Schrift- und Kontoprüfung als eigene Welle. Jede Sprache geht mit vollständigem Katalog und eigener Abnahme live. Die Reihenfolge kann nach Übersetzungsreife angepasst werden.
4. Je Welle den aktiven Stand beider Domains als Rollback erfassen, den Kandidaten mit den vorhandenen Ressourcen bauen und nach ausdrücklicher Freigabe veröffentlichen. Unmittelbar danach Domains, DE/EN, neue Sprachen, Auth-Einstiege, SEO und Cache prüfen. Bei kritischen Befunden die vorige Version wiederherstellen.

Dieser Stand ist Planungsdokumentation. Es wurden keine Kataloge, Anwendungsdateien, Produktionsdaten, Dienste oder Deployments geändert.
