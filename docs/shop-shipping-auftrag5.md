# Auftrag 5 – Zentrale Versandverwaltung

## Stand und Architektur

Die produktive Leseprüfung ergab genau eine aktive SKU im Checkout-Katalog, den Kalender `UHL-KAL-2027-A3`. Die bestehende Versandfreigabe umfasst Deutschland, Österreich und die Schweiz. Der Aufnäher `UHL-PATCH-001` steht als Entwurf mit Eigenversand und 5,00 € im geschützten Produktbestand. Er hat 98 verfügbare, 0 reservierte und 0 verkaufte Stück.

Der Kalender-Checkout verwendet weiterhin `shop_catalog_products`, `shop_shipping_regions`, die vorhandene Gelato-Angebotsfunktion und das vorhandene signierte Angebot. Der lokale Vergleich mit dem zuletzt veröffentlichten Release bestätigt identischen Code für Kalender-Checkout, Gelato, Stripe, PayPal, Rechnung, Bestellbestätigung und Statusjobs. Die neue Berechnung ist von den Live-Routen getrennt und kann später die bestehende Gelato-Angebotsfunktion über einen Partneradapter aufrufen.

## Lokal umgesetzt

- Die Kachel „Versand“ öffnet die geschützte zentrale Tarifverwaltung. Administratoren können Tarife anlegen, bearbeiten, aktivieren und deaktivieren. Versandbezeichnung, Dienstleister, Fulfillment, Länder, Zone, Preis, Höchstmaße, Gewicht, Ablaufdatum, Tracking und Lieferzeit lassen sich pflegen. Partnerpreise stammen bei einer späteren Anbindung aus Partnerangeboten. Es gibt keinen festen Partnerpreis.
- „Versand & Fulfillment“ in der Produktverwaltung bietet eine Mehrfachauswahl, Länderbeschränkungen, die Beschränkung auf Deutschland und verpackte Maße einschließlich Gewicht. Ein Standardbrief erfordert eine Bestätigung der Messung und maschinellen Verarbeitbarkeit. Inaktive Tarife bleiben für die Vorbereitung zuordenbar.
- Die additive Migration `20261109_shop_shipping_rates.sql` legt eine private Tariftabelle und eine optionale Konfigurationsspalte in `shop_merchandise` an. Der Tarifcode ist Primärschlüssel und bleibt im Admin unveränderlich. Produktzuordnungen werden bei einem Speichervorgang gemeinsam auf Vorhandensein und Fulfillment geprüft. Die neuen Tarife haben RLS und sind für normale Clients gesperrt. API-Schreibzugriffe erfordern Admin-Anmeldung und gleiche Herkunft. Die Versionskennung verhindert das Überschreiben paralleler Änderungen. Beim Öffnen der betreffenden Admin-Ansicht wird die Tarifliste einmal geladen.
- Die Migration erhält Lagerbuchungen, Bestand, Bilder und Produktstatus des Aufnähers. Sie bricht ab, falls sich sein geprüfter Ausgangszustand geändert hat. Der Standardbrief Deutschland ist mit 95 Cent zugeordnet und bleibt inaktiv. Deutsche Post Kompakt-, Groß- und Maxibrief, DHL Kleinpaket und Paket sowie Gelato sind inaktive Beispiele ohne bestätigten Tarifpreis.

## Berechnung und Grenzen

Der vorbereitete Serverbaustein verwendet ausschließlich serverseitig geladene Preise, Freigaben und Bestandsdaten. Eine Eigenversandsendung wird einmal berechnet und erhält nur Versandarten, die allen enthaltenen Produkten gemeinsam sind. Der Packplan muss alle Mengen genau einmal abdecken. Lagerverfügbarkeit, Landesfreigaben, Maße, Tarifstatus und Gültigkeit werden geprüft. Partnerpositionen werden nach Anbieter gruppiert. Pro Gruppe wird ein Angebot eingeholt und pro Sendung beziehungsweise Partnergruppe genau eine Option berechnet. Aus dem Browser kommen später nur die Methodenkennungen. Fehlende oder unklare Daten führen zu einer Ablehnung.

Vor dem Drop braucht es eine serverseitige Packregel für die tatsächlich verwendete Verpackung und einen Adapter zum bestehenden Gelato-Angebot. Der spätere Checkout muss die bestätigte Zusammenstellung und die Versandbeträge gemeinsam signieren und beim Kauf erneut validieren. Die vorhandene Lagerreservierung bleibt maßgeblich und muss vor dem Start der Zahlung atomar erfolgen. Bei gemischten Käufen müssen Fulfillment und Zahlung positionsbezogen angebunden und einschließlich Storno, Teilfehlern, Rechnung und Gelato-Übergabe getestet werden. Die öffentliche Verkaufsfreigabe muss ausdrücklich aus dem freigegebenen Katalog stammen.

Für den Standardbrief Deutschland gelten laut Deutsche Post 140–235 mm Länge, 90–125 mm Breite, höchstens 5 mm Dicke und 20 g Gesamtgewicht. Die Länge muss mindestens das 1,4-Fache der Breite betragen. Die verpackte Sendung muss sich maschinell verarbeiten lassen. Die konkrete Verpackung und der Aufnäher wurden nicht physisch geprüft. Der vorbereitete Tarif über 95 Cent gilt bis einschließlich 31. Dezember 2026. Für den 1. Januar 2027 nennt die Deutsche Post 1,15 €. Der künftige Kundenpreis ist separat zu bestätigen. Die übrigen Tarife benötigen freigegebene Preise beziehungsweise Partnerangebote, Zonen, Grenzen und gegebenenfalls Tracking und Laufzeiten. [Leistungs- und Preisverzeichnis](https://www.deutschepost.de/dam/jcr%3Ac0eb1285-9a22-40b2-8c51-3f70c1a897be/dp-leistungen-und-preise-07-2024.pdf) · [Änderungen ab 2027](https://www.deutschepost.de/de/a/aenderungen2027.html)

## Rollout und Rückweg

Nach Freigabe Backup und Ausgangszustand erneut kontrollieren. Die einzelne additive Migration anwenden. Rechte, inaktive Beispieltarife, Patch-Entwurf, Preis und Lagerbestand prüfen. Anschließend nur die geschützte Admin-Fassung bereitstellen und Kalenderseite, Checkout, bestehende Versandabfrage und die Gelato-Jobkonfiguration lesend prüfen. Der vorherige Vercel-Release ist der Anwendungsrückweg. Die additiven Strukturen können dabei bestehen bleiben. Vor einer späteren Entfernung der Spalte oder Tabelle neu erfasste Tarife und Zuordnungen exportieren.

Die Checkout-Anbindung und öffentliche Freigabe des Drops erfordern eine gesonderte Entscheidung. In diesem Auftrag wurden keine produktive Migration, kein Deployment und keine Testbestellung mit echter Zahlung ausgeführt.

## Prüfergebnisse

- 53 automatisierte Tests bestanden. Dazu gehören Tarifverwaltung, Produktzuordnung, Einzel- und Sammelsendungen, Partner- und Mischbestellungen, Landesbeschränkungen, fehlender Bestand, abgelaufene Tarife und manipulierte Methodenauswahl. Der PostgreSQL-Test prüfte auch unveränderte Kalender-, Bestell-, Zahlungs-, Rechnungs- und Gelato-Datenstände nach der Migration.
- TypeScript, ESLint für die geänderten Dateien und der lokale Next.js-Produktionsbuild waren erfolgreich. In Chrome wurden der Tarifeditor am Desktop und die Mehrfachzuordnung beim Aufnäher in Mobilbreite mit simulierter Admin-Anmeldung und simulierten Datenantworten geprüft.

## Produktionsmigration und Release-Prüfung am 8. November 2026

- Supabase meldete das physische Backup `2199583261` vom selben Tag um 04:09 MEZ als abgeschlossen. PITR war deaktiviert. Vor der Migration gab es weder die Tariftabelle noch die Produktspalte. Der Kalender war die einzige aktive Checkout-SKU. Der Patch war unverändert Entwurf mit Eigenversand, 5,00 € und 98 verfügbaren Stück.
- Ausschließlich `20261109_shop_shipping_rates.sql` wurde als Einzeldatei ausgeführt. Um 10:03 MEZ waren RLS und die Sperre für anonyme und regulär angemeldete Datenbankrollen bestätigt. Die sieben Tarife sind inaktiv. Der Aufnäher ist als Entwurf mit unverändertem Preis und Bestand gespeichert. Seine einzige Zuordnung ist der inaktive Standardbrief Deutschland zu 0,95 €. Die Verpackungsprüfung ist offen.
- Der Produktions-Schreibtest mit der Serverrolle deckte Tarifanlage, Änderung, Schutz gegen veraltete Versionen und die Zuordnung zweier Tarife zu einem Testprodukt ab. Die Transaktion wurde vollständig zurückgerollt. Danach blieben genau sieben Tarife, kein aktiver Tarif und kein Testprodukt. Die echten Tarif- und Patch-Leseabfragen über PostgREST funktionierten. Ein anonymer Direktzugriff wurde abgewiesen.
- Während der Vorbereitung wurde ein separater Milestone-Release `dpl_6MvMCSiPk2fPu2XrS3gwS5VfNWYm` auf die Hauptdomain geschaltet. Der neue Versand-Kandidat `dpl_8nmvcpirVNtNqiEZHq5Mha9f5oYR` enthält die beiden Milestone-Dateien unverändert. Sein Hashvergleich mit dem Milestone-Release weist ausschließlich elf Versand- und Admin-Dateien aus. Der Vercel-Build enthält die Admin-Oberfläche und die geschützte API. [Dateivergleich](shop-shipping-release-scope.json)
- Der separate Milestone-Release enthält den zuvor aktiven deploymentgebundenen Gelato-Statusschalter nicht. Der Versand-Kandidat enthält ihn mit dem bisherigen Wert. Die Domain-Umschaltung wurde angehalten, bis geklärt ist, ob der zuvor aktive 15-Minuten-Abgleich wiederhergestellt werden soll.

## Umschaltung nach Gelato-Freigabe

Nach ausdrücklicher Bestätigung wurde `dpl_8nmvcpirVNtNqiEZHq5Mha9f5oYR` auf die Hauptdomain geschaltet. Der Release erhält die beiden parallelen Milestone-Änderungen und stellt den zuvor aktiven Gelato-Statusschalter mit dem bisherigen Wert wieder her. Die Vercel-Zeitpläne zeigen den Shop-Job minütlich und den Gelato-Statusjob viertelstündlich auf dem neuen Deployment.

Die veröffentlichte Versand- und Produktverwaltung wurde am Desktop beziehungsweise in Mobilbreite mit echten Tarif- und Patch-Lesedaten, simulierter Admin-Anmeldung und simulierten Schreibantworten geprüft. Reale Datenbank-Schreiboperationen waren separat in einer zurückgerollten Transaktion geprüft worden. Anonyme Live-API-Aufrufe ergaben HTTP 403. Die Milestone-Admin-Seite, die Versandseite und der Kalender-Checkout antworteten mit HTTP 200. Ein Kalender-Versandangebot mit Testadressdaten lieferte 29,90 € zuzüglich Versand. Es wurden keine Bestellungen, Zahlungen oder Gelato-Produktionsaufträge erzeugt.

Als Anwendungsrückweg dient der Milestone-Stand `dpl_6MvMCSiPk2fPu2XrS3gwS5VfNWYm`. Eine direkte Rückschaltung auf dessen vorhandenes Deployment würde den Gelato-Schalter erneut verlieren. Für einen Rückweg mit laufendem Gelato-Abgleich muss derselbe Milestone-Quellstand daher als eigener Kandidat mit dem bestätigten Schalter gebaut und geprüft werden. Die additive Datenbankstruktur bleibt bei einem Anwendungsrollback bestehen.

Der erste reguläre Statuslauf nach der Wiederherstellung antwortete am 8. November 2026 um 10:30:30 MEZ mit HTTP 200. Zwischen Vor- und Nachmessung stieg die Anzahl der Datenbank-Claims von 99 auf 100. Es gab keinen zusätzlichen Statusversuch und keinen Apply-Aufruf. Die zugestellte LIVE-Sendung blieb im Zustand `idle`. Die produktiven Funktionen wurden außerdem auf die Fälligkeitsprüfung und den Mindestabstand von sechs Stunden für `shipped` und `in_transit` geprüft.

Der Gelato-Schalter ist jetzt dauerhaft in der Vercel-Produktionsumgebung hinterlegt. Die Repository-Vorgabe und die gemeinsame Release-Prüfung erfassen sowohl die Live-Dateien als auch die sichtbaren Produktionsvariablen. [Gemeinsamer Release-Prozess](production-release.md)
