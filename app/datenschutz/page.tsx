import Link from 'next/link'

export default function DatenschutzPage() {
  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-white md:text-4xl">
          Datenschutzerklärung
        </h1>

        <div className="mt-6 space-y-5 text-sm leading-7 text-stone-300">
          <p>
            Der Schutz deiner persönlichen Daten ist uns wichtig. Diese Website
            verarbeitet personenbezogene Daten ausschließlich im Rahmen der
            geltenden datenschutzrechtlichen Vorschriften.
          </p>

          <h2 className="text-lg font-semibold text-white">
            1. Verantwortlicher
          </h2>

          <p>
            Philipp Dobrinski
            <br />
            Ultimate Hiking League
            <br />
            Ansbacher Straße 4a
            <br />
            91452 Wilhermsdorf
            <br />
            Deutschland
          </p>

          <p>
            E-Mail: ultimatehikingleague@gmail.com
          </p>

          <h2 className="text-lg font-semibold text-white">
            2. Zugriffsdaten und technische Bereitstellung
          </h2>

          <p>
            Beim Besuch dieser Website können technisch erforderliche Daten
            verarbeitet werden, insbesondere Informationen zum verwendeten
            Browser, Betriebssystem, Gerät, Datum und Uhrzeit des Zugriffs sowie
            weitere technisch notwendige Verbindungsdaten. Diese Verarbeitung
            erfolgt, um die Website sicher und stabil bereitzustellen.
          </p>

          <h2 className="text-lg font-semibold text-white">
            3. Benutzerkonten und eingereichte Inhalte
          </h2>

          <p>
            Wenn du ein Benutzerkonto erstellst oder Inhalte auf der Plattform
            einreichst, verarbeiten wir die von dir angegebenen Daten, um die
            Funktionen der Ultimate Hiking League bereitzustellen. Dazu können
            insbesondere Kontodaten, Profildaten, eingereichte Wanderungen,
            hochgeladene Nachweise und freiwillige Angaben gehören.
          </p>

          <p>
            Die Verarbeitung erfolgt, soweit sie für die Nutzung der Plattform
            und die Durchführung deiner Anfrage oder Einreichung erforderlich
            ist.
          </p>

          <h2 className="text-lg font-semibold text-white">
            3a. Wanderungen, Nachweise und automatische Texterkennung
          </h2>

          <p>
            Wenn du eine Wanderung einreichst, verarbeiten wir die Zuordnung zu
            deinem Konto, die Angaben zur Aktivität und die beigefügten Nachweise.
            Dazu gehören je nach Einreichung Datum, Distanz, Gesamtzeit, Höhenmeter
            und Veranstaltungsangaben. Wir verwenden diese Daten, um deine
            Einreichung zu bearbeiten, die Leistung zu prüfen, doppelte Wertungen
            zu verhindern und freigegebene Ergebnisse nach dem Regelwerk zu werten.
            Soweit die Verarbeitung hierfür zur Durchführung deiner Teilnahme
            erforderlich ist, erfolgt sie nach Art. 6 Abs. 1 Buchst. b DSGVO.
          </p>

          <p>
            Wenn du einen Garmin-Connect-Screenshot zum Import auswählst, liest
            eine automatische Texterkennung in deinem Browser mögliche Werte für
            das Formular aus. Du kannst die Vorschläge prüfen und korrigieren.
            Beim Absenden werden die bestätigten Originalbilder in einem privaten
            Speicherbereich bei Supabase abgelegt und mit der Einreichung
            verknüpft. Zugriff auf diese Originale haben dein Konto und
            berechtigte Mitglieder des Prüfteams. Jede Einreichung wird vor
            der Wertung administrativ geprüft. Wir nutzen Vercel für die
            Bereitstellung der Website und Supabase für Anmeldung, Datenbank
            und Nachweisspeicherung.
          </p>

          <p>
            Nach der Freigabe können dein angezeigter Profilname und
            Leistungsdaten wie Distanz, Gesamtzeit, Höhenmeter und Platzierung
            öffentlich erscheinen. Freigegebene Ergebnisse offizieller Events
            werden öffentlich geführt. Bei privaten Wanderungen gilt die
            im Formular gewählte Sichtbarkeit. Die privaten Originalbilder aus
            dem Screenshot-Import erscheinen nicht in den Ranglisten.
          </p>

          <p>
            Wir speichern Einreichungen und Nachweise, solange wir sie für
            Prüfung, Wertung oder Rückfragen benötigen. Löschanfragen kannst
            du an ultimatehikingleague@gmail.com richten. Bei der Bearbeitung
            prüfen wir auch gesetzliche Aufbewahrungspflichten und die
            gegebenenfalls erforderliche Aufbewahrung für Rechtsansprüche.
          </p>

          {process.env.NODE_ENV !== 'production' && (<>
          <h2 id="milestone-shop" className="scroll-mt-8 text-lg font-semibold text-white">
            3b. Milestone-Shop und Gutscheincodes
          </h2>
          <p>
            Für den Milestone-Shop verarbeiten wir die Zuordnung zu deinem Benutzerkonto
            und Hiker-Profil, Punktegutschriften und -abbuchungen sowie zugeteilte
            Prämien und Gutscheincodes, deren Status und den Zeitpunkt der Zuteilung.
            Dies dient der Berechnung deines Guthabens, der Durchführung und Dokumentation
            deiner Einlösungen sowie der Vermeidung mehrfacher Codevergaben.
            Rechtsgrundlage ist Art. 6 Abs. 1 Buchst. b DSGVO, soweit die Verarbeitung
            für die Bereitstellung und Nutzung des Milestone-Angebots erforderlich ist.
          </p>
          <p>
            Die Speicherung erfolgt über die eingesetzte Supabase-Infrastruktur.
            Die aktuelle Codezuteilung übermittelt dem Händler nicht automatisch deinen
            Namen, deine E-Mail-Adresse oder deine Anschrift. Wenn du einen Code auf
            einer Händlerwebsite einlöst, verarbeitet der Händler die von dir dort
            angegebenen Daten in eigener Verantwortung. Beachte hierzu seine
            Datenschutzhinweise.
          </p>
          <p>
            Die Zuordnung und Buchungshistorie werden gespeichert, soweit dies für
            Guthabenverwaltung, den Zugriff auf zugeteilte Codes und die Klärung von
            Einlösungen erforderlich ist. Im Übrigen gelten die nachfolgend beschriebenen
            Kriterien zur Speicherdauer und deine Datenschutzrechte.
          </p>

                    </>)}
          <h2 className="text-lg font-semibold text-white">
            4. Nutzung von Supabase
          </h2>

          <p>
            Für Datenbank-, Authentifizierungs- und Speicherfunktionen nutzen wir
            den Dienst Supabase. Dabei können personenbezogene Daten verarbeitet
            werden, soweit dies für den Betrieb der Plattform erforderlich ist,
            insbesondere zur Verwaltung von Benutzerkonten, Logins,
            Einreichungen und hochgeladenen Dateien.
          </p>

          <h2 className="text-lg font-semibold text-white">
            5. Cookies und ähnliche Technologien
          </h2>

          <p>
            Diese Website verwendet notwendige Technologien, die für den Betrieb
            der Website erforderlich sind. Darüber hinaus verwenden wir
            Statistik-Technologien nur dann, wenn du hierzu ausdrücklich
            eingewilligt hast.
          </p>

          <p>
            Deine Auswahl kannst du beim ersten Besuch über den
            Cookie-Hinweis treffen. Eine bereits getroffene Entscheidung kannst
            du später über den Bereich{" "}
            <Link
              href="/cookie-einstellungen"
              className="text-stone-200 underline underline-offset-4 hover:text-white"
            >
              Cookie-Einstellungen
            </Link>{" "}
            erneut ändern oder zurücksetzen.
          </p>

          <h2 className="text-lg font-semibold text-white">
            6. Google Analytics
          </h2>

          <p>
            Sofern du eingewilligt hast, nutzen wir Google Analytics, einen
            Webanalysedienst von Google, um die Nutzung unserer Website
            statistisch auszuwerten und unser Angebot zu verbessern.
          </p>

          <p>
            Google Analytics wird auf dieser Website nur nach deiner aktiven
            Zustimmung geladen. Wenn du nur notwendige Technologien auswählst,
            erfolgt keine Aktivierung von Google Analytics.
          </p>

          <p>
            Im Rahmen der Nutzung von Google Analytics können Informationen über
            die Nutzung der Website verarbeitet werden, etwa aufgerufene Seiten,
            Interaktionen, technische Informationen zum Browser und zum Gerät
            sowie ungefähre Standortdaten.
          </p>

          <p>
            Anbieter:
            <br />
            Google Ireland Limited
            <br />
            Gordon House, Barrow Street
            <br />
            Dublin 4
            <br />
            Irland
          </p>

          <p>
            Weitere Informationen zu Google Analytics findest du in den
            Datenschutzhinweisen von Google.
          </p>

          <h2 className="text-lg font-semibold text-white">
            7. Rechtsgrundlagen
          </h2>

          <p>
            Soweit wir notwendige Daten zur technischen Bereitstellung der
            Website oder zur Durchführung deiner Anfrage bzw. zur Bereitstellung
            der Plattformfunktionen verarbeiten, erfolgt dies auf Grundlage der
            hierfür einschlägigen gesetzlichen Erlaubnistatbestände.
          </p>

          <p>
            Soweit Statistik-Technologien wie Google Analytics eingesetzt werden,
            erfolgt dies ausschließlich auf Grundlage deiner Einwilligung.
          </p>

          <h2 className="text-lg font-semibold text-white">
            8. Speicherdauer
          </h2>

          <p>
            Wir speichern personenbezogene Daten nur so lange, wie dies für die
            jeweiligen Zwecke erforderlich ist oder gesetzliche
            Aufbewahrungspflichten bestehen.
          </p>

          <h2 className="text-lg font-semibold text-white">
            9. Deine Rechte
          </h2>

          <p>
            Du hast im Rahmen der gesetzlichen Voraussetzungen insbesondere das
            Recht auf Auskunft über die bei uns gespeicherten personenbezogenen
            Daten, auf Berichtigung unrichtiger Daten, auf Löschung, auf
            Einschränkung der Verarbeitung sowie auf Widerspruch gegen die
            Verarbeitung. Sofern die Verarbeitung auf deiner Einwilligung
            beruht, kannst du diese jederzeit mit Wirkung für die Zukunft
            widerrufen. Die DSGVO regelt diese Betroffenenrechte in Art. 15 bis
            21; zusätzlich besteht das Recht auf Datenübertragbarkeit nach Art.
            20 DSGVO. 
          </p>

          <p>
            Zudem hast du das Recht, dich bei einer Datenschutzaufsichtsbehörde
            zu beschweren.
          </p>

          <h2 className="text-lg font-semibold text-white">Outdoor Store: Bestellung, Zahlung und Widerruf</h2>
          <p>Bei Bestellungen verarbeiten wir Namen, Liefer- und Rechnungsanschrift, E-Mail-Adresse, gegebenenfalls Telefonnummer, Artikel, Mengen, Versandwahl und Zahlungsstatus zur Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO). Erforderliche Lieferdaten übermitteln wir zur Versandberechnung und Abwicklung an unsere beauftragten Produktions- und Versanddienstleister. Vollständige Kartendaten werden ausschließlich beim gewählten Zahlungsanbieter verarbeitet. Die Zahlung erfolgt über Stripe oder PayPal; deren Datenschutzhinweise gelten ergänzend für die dortige Verarbeitung.</p>
          <p>Bestell- und Rechnungsdaten speichern wir geschützt in unserer Supabase-Datenbank. Die Website wird bei Vercel betrieben. Vertragsbestätigungen und Eingangsbestätigungen elektronischer Widerrufe versenden wir über Resend. Bei diesen Diensten können Verarbeitungen außerhalb der EU bzw. des EWR erfolgen; maßgeblich sind die jeweils vereinbarten Auftragsverarbeitungs- und Übermittlungsregelungen, insbesondere gegebenenfalls EU-Standardvertragsklauseln. Weitere Informationen finden Sie in den Datenschutzhinweisen der Anbieter: stripe.com/privacy, paypal.com/privacy, supabase.com/privacy, vercel.com/legal/privacy-policy und resend.com/legal/privacy-policy.</p>
          <p>Die elektronische Widerrufsfunktion erfasst Ihren Namen, die angegebene E-Mail-Adresse und Ihre Angaben zum widerrufenen Vertrag sowie den Eingangszeitpunkt, um den Widerruf zu bearbeiten und dessen Eingang zu bestätigen (Art. 6 Abs. 1 lit. b und c DSGVO). Eine Kontoregistrierung ist dafür nicht erforderlich. Bestellzugriffe werden durch ein technisch erforderliches, zeitlich begrenztes Sicherheits-Cookie geschützt. Zur Missbrauchsbegrenzung verarbeiten wir kurzzeitig einen pseudonymisierten Anfrageschlüssel auf Grundlage unseres berechtigten Interesses am sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO).</p>
          <p>Aufbewahrungspflichtige Rechnungsunterlagen werden grundsätzlich acht Jahre, sonstige handels- bzw. steuerrechtlich aufbewahrungspflichtige Unterlagen je nach Kategorie sechs oder zehn Jahre aufbewahrt (Art. 6 Abs. 1 lit. c DSGVO). Andere Bestell- und Widerrufsdaten werden gelöscht, sobald sie für Vertragsabwicklung, Rechtsansprüche und gesetzliche Aufbewahrung nicht mehr benötigt werden. Auskunft zu den konkreten Empfängern Ihrer Daten erhalten Sie über die unten genannte Kontaktadresse.</p>

          <h2 className="text-lg font-semibold text-white">
            10. Kontakt
          </h2>

          <p>
            Bei Fragen zum Datenschutz kannst du dich jederzeit an uns wenden:
            <br />
            ultimatehikingleague@gmail.com
          </p>
        </div>
      </div>
    </main>
  )
}