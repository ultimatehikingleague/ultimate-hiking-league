# UHL Internationalisierung · Phase 2

Stand 16. November 2026. Arbeitskopie `Internationalisierung-Phase-2` im UHL-Workspace. Ausgangspunkt ist der verifizierte Quellstand des produktiven Deployments `dpl_4rEFDaQ4d87E9vdwuQvbM5QiA66o`. Die Umsetzung befindet sich in einer isolierten UHL-Kopie. Die Hauptdomains wurden für diesen Arbeitsabschnitt nicht umgeschaltet.

## Technisches Grundsystem

- `next-intl@4.15.1` ist fest versioniert. Die Anwendung liest `messages/de.json` und `messages/en.json` ohne externen Übersetzungsdienst. Die vorhandenen URLs und die Middleware bleiben erhalten. `i18n/next-intl.d.ts` bindet den englischen Katalog als Schlüsseltyp ein.
- `i18n/request.ts` löst die Sprache vor dem ersten HTML auf. Eine gültige manuelle Wahl gewinnt. Sonst werden unterstützte Spracheinträge aus `Accept-Language` nach Gewichtung ausgewertet. `de-AT` und `en-GB` entsprechen in Stufe 2 jeweils `de` und `en`. Ohne Treffer gilt Englisch.
- `i18n/actions.ts` schreibt `uhl_language` für den jeweiligen Host. Es ist ein HTTPS-geschütztes Host-Cookie in Produktion, verwendet `HttpOnly`, `SameSite=Lax`, `Path=/` und eine Laufzeit von 365 Tagen. Die Auswahl „Browser“ entfernt die manuelle Vorgabe. Die Aktion akzeptiert nur die registrierten Sprachen oder „auto“. Sie nimmt keine URL und keinen Authentifizierungswert entgegen.
- Der Sprachumschalter ist als kompaktes Dropdown in der vorhandenen Navigation beziehungsweise rechts oben im gemeinsamen Seitenrahmen erreichbar. Das Menü enthält „Deutsch“, „English“ und die aktuell erkannte Browsersprache. Der serverseitige Neurender behält URL und Client-Zustand bei. Unübersetzte Seiteninhalte sind weiterhin deutsch ausgezeichnet. Das Setzen des Cookies erfordert weder eine Anmeldung noch eine Datenbankänderung.

## Übersetzungsumfang und Corporate Identity

| Übersetzt | Umfang |
| --- | --- |
| Homepage | Navigation, Begleittexte, Challenge-Vorschau und Beitrittsmeldungen, Fortschritt, Rankingkarten, Aktivitäts- und Event-Übersicht, Leerzustände |
| Ranglisten | Hub, Gesamtrangliste und Länderrangliste unter `/leaderboard`, `/leaderboard/overall` und `/leaderboard/country` |
| Divisionen | Übersicht unter `/division` und Detailansichten `/division/gold`, `/division/platinum`, `/division/silver` |
| Gemeinsam genutzte Oberfläche | Sprachwahl, grundlegende Cookie-Hinweise, Footer-Navigation und öffentliche Werbekennzeichnung |

„**Show us who you are.**“ bleibt exakt so im Frontend und wird mit `lang="en"` ausgezeichnet. Der Slogan steht nicht in den Katalogen. ULTIMATE-Logo und übrige feste Markenelemente werden weder textlich noch grafisch bearbeitet. „Europas Liga für echte Hiker!“ erhält dagegen eine englische Fassung. Dasselbe gilt für normale Systemtexte. Divisions-, Event-, Marken- und Profilnamen sowie von Nutzern oder Veranstaltern gelieferte Inhalte bleiben erhalten. Die Ranglisten zeigen sprachabhängige Zahlenformate mit den bestehenden zwei Nachkommastellen. Rankingwerte, Filterlogik, Gruppierung und Einheiten wurden nicht geändert.

Separate Eventdetailseiten, Skyscraper, Challenge-Detailseiten, Kontoinhalte, Shopprozesse, Administration, E-Mails und juristische Texte gehören nicht zur vollständigen DE/EN-Fassung dieser Stufe. Die übersetzten gemeinsamen Navigationselemente können auch dort erscheinen.

## Domainwechsel bei Google-Anmeldung und Passwort-Reset

Die Spracheinstellung bleibt auf demselben Host bei Navigation, Reload und späteren Besuchen erhalten. Die isolierte Probe mit `localhost` und `127.0.0.1` bestätigt getrennte Cookie-Speicherung. Der Wechsel der URL auf einen anderen Host übernimmt die dortige Auswahl oder startet auf diesem Host mit der Browsererkennung.

Google-Anmeldung und Passwort-Reset auf der European-Hiking-League-Domain verwenden derzeit feste Rücksprungadressen auf `www.ultimatehikingleague.com`. Ein Cookie der European-Hiking-League-Domain steht dort nicht zur Verfügung. Besteht bereits ein UHL-Sprachcookie, verwendet die Hauptdomain diesen Wert. Eine abweichende manuelle Auswahl auf der Ausgangsdomain wird dabei nicht automatisch übernommen. Die Implementierung hat keinen Eingriff in diese Abläufe vorgenommen.

**Vorschlag zur gesonderten Freigabe:** Supabase-Zieladressen für `/login` und `/reset-password` auf beiden ausdrücklich erlaubten Hosts prüfen und, falls erforderlich, ergänzen. Die App wählt dann nur aus vier festen HTTPS-Zielen auf diesen beiden Hosts, abhängig vom Ausgangshost und vom Vorgang. Der vorhandene Pfad bleibt bestehen. Eingaben, Session-Daten, OAuth-State und Reset-Fragment verbleiben im jeweiligen bestehenden Authentifizierungsablauf. Bestehende Links zur Hauptdomain bleiben gültig. Die Alternative erfordert eine genau begrenzte Änderung an Rücksprungzielen und gegebenenfalls der Provider-Konfiguration. Vor Freigabe Google-Rücksprung, echte Reset-Links, abgelaufene Links und Rücksprung auf beiden Hosts mit isolierten Provider-Testkonten prüfen. Eine allgemeine Synchronisation der Präferenz zwischen unabhängigen Domains oder Geräten folgt daraus nicht.

## Geänderte Dateien

- Infrastruktur · `package.json`, `package-lock.json`, `next.config.ts`, `app/layout.tsx), `i18n/{actions,display,locales,request}.ts`, `i18n/next-intl.d.ts`, `messages/{de,en}.json`.
- Komponenten · `app/components/{LanguageSwitcher,ContentLanguage,Nav,BrandHeader,CookieConsentBanner,SiteFooter,PartnershipFooter,PartnerPlacements,PastEventLeaderboardFilters,ChristmasChallengeJoinButton}.tsx`. Bei Partner- und Challenge-Komponenten beschränken sich die Änderungen auf die sichtbaren Formulierungen.
- Seiten · `app/page.tsx`, die drei genannten Ranglistenansichten, Divisionsübersicht und drei Divisionsdetails.
- Test · `tests/i18n.test.mts`, lokal ausführbar mit `npm run test:i18n`.

## Prüfungen und Freigabepunkte

- Automatisch geprüft · Auflösung gewichteter und regionaler Browserwerte, ungültige Präferenz, Fallback und Cookie-Vorrang. Kataloggleichheit, Unicode, ICU-Plural, Platzhalter, Rich Text und Zahlenformat. Der automatisierte Test hält den Slogan aus den Nachrichtenkatalogen heraus und prüft seinen exakten Wortlaut auf der Homepage.
- HTTP in der isolierten Kopie · DE, EN und Fallback bereits im ersten HTML. Bestehende URLs für Homepage, Rankings, Divisionen, Login, Reset, Events und Store. Die drei geprüften gesperrten Routen lieferten weiterhin 404.
- Chrome · Desktop bei 1.601 Pixeln, Mobil bei 390 Pixeln. Sprachwechsel, Navigation, Reload, Rückkehr zur Browsererkennung und unterschiedliche Präferenzen auf zwei lokalen Hosts. Auf der mobilen Gesamtrangliste blieben Suche, Query und Fragment beim Umschalten erhalten. Auf Homepage und Ranking-Hub im geprüften Mobilviewport kein horizontaler Seitenüberlauf. Login und Reset wurden als bestehende Einstiegsseiten geöffnet. Echte Google-Anmeldung, produktiver Passwort-Reset und Zustellung von Reset-Mails wurden nicht ausgelöst.
- Der Zugriff auf Header und Cookie im Root-Layout macht viele bisher statisch generierte Seiten dynamisch. Deshalb vor einem Release CDN-Verhalten und Ladezeit gegen den damaligen Live-Stand prüfen. In diesem Pilot bleiben Canonical und Sitemap ohne zusätzliche Sprach-URLs. Die Nacharbeiten für getrennte indexierbare Fassungen bleiben im Plan aus Phase 1.
- Der Build und die Browsertests arbeiten gegen einen isolierten Datenservice. Der Release ist freigabepflichtig. Es wurden keine Nutzer, Buchungen oder Aktivitäten in Produktion erzeugt.

Die endgültige Menüfassung, die Messwerte und die Releaseempfehlung stehen in der [Abschlussprüfung](internationalisierung-phase-2-releaseprüfung.md).

Der weitere Ausbau auf 14 Zielsprachen ist im [Plan für Phase 3](internationalisierung-phase-3.md) beschrieben.
