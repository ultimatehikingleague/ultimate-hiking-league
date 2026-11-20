import Link from 'next/link'

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-3xl">

        {/* Zurück Button */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-block rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-stone-200 transition hover:border-white/20 hover:bg-white/10"
          >
            ← Zurück zur Startseite
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-6">FAQ</h1>

        <p className="mb-8 text-stone-400">
          Die wichtigsten Fragen zur Ultimate European Hiking League.
        </p>

        <div className="space-y-6">

          <div>
            <h2 className="font-semibold text-lg">Kostet die Teilnahme etwas?</h2>
            <p className="text-stone-400 mt-2">
              Nein. Die Teilnahme ist komplett kostenlos.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">Warum sollte ich meine Wanderungen eintragen?</h2>
            <p className="text-stone-400 mt-2">
              Du bekommst dein komplettes Leistungsbild auf einen Blick:
              Gesamt-km, Höhenmeter, Geschwindigkeit und Entwicklung.
              Ohne Filter, ohne Rechnerei.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">Ist das nur ein Vergleich mit anderen?</h2>
            <p className="text-stone-400 mt-2">
              Nein. Du vergleichst dich auch mit dir selbst und siehst,
              wie sich deine Leistung über Zeit entwickelt.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">Wie kann ich meinen angezeigten Namen von pseudo in bürgerlich ändern?</h2>
            <p className="text-stone-400 mt-2">
              Schreibe uns bitte eine E-Mail an ultimatehikingleague@gmail.com
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">Kann ich auch GPX Dateien hochladen?</h2>
            <p className="text-stone-400 mt-2">
              Nein. Am besten nur Screenshots oder Fotos mit allen relevanten Daten. Bei Events reicht auch eine 
              personalisierte Finisherurkunde. Wobei hier nur die geforderten Kilometer angerechnet werden.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">Muss ich an offiziellen Events teilnehmen?</h2>
            <p className="text-stone-400 mt-2">
              Nein. Du kannst auch deine eigenen Wanderungen eintragen.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">Muss ich meine Wanderungen tracken?</h2>
            <p className="text-stone-400 mt-2">
              Ja, aber du kannst jede App nutzen (Garmin, Komoot, Outdooractive etc.).
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">Wie verbinde ich Garmin Connect mit der Ultimate Hiking League?</h2>
            <p className="text-stone-400 mt-2">
              Mit Garmin Connect kannst du deine aufgezeichneten Wanderungen bequem in die Ultimate Hiking League übernehmen – ohne Distanz, Zeit und Höhenmeter selbst eingeben zu müssen.
            </p>
            <p className="text-stone-400 mt-2">So funktioniert’s:</p>
            <ol className="text-stone-400 mt-2 list-decimal space-y-1 pl-6">
              <li>Melde dich bei der Ultimate Hiking League an und öffne deinen Account.</li>
              <li>Verbinde dort dein Garmin-Konto mit UHL und erteile die erforderlichen Berechtigungen.</li>
              <li>Zeichne deine Wanderungen wie gewohnt mit deiner Garmin-Uhr auf und synchronisiere sie mit Garmin Connect.</li>
              <li>Klicke in der Ultimate Hiking League auf „Wanderung hinzufügen“ und wähle „Aus Garmin importieren“.</li>
              <li>Wähle die gewünschte Wanderung aus und überprüfe die automatisch übernommenen Angaben.</li>
              <li>Klicke auf „Wanderung veröffentlichen“.</li>
            </ol>
            <p className="text-stone-400 mt-2">
              Erfüllt deine Aktivität die Teilnahmebedingungen, wird sie automatisch als verifizierter Eintrag in die Liga übernommen.
            </p>
            <p className="text-stone-400 mt-2">Gut zu wissen:</p>
            <ul className="text-stone-400 mt-2 list-disc space-y-1 pl-6">
              <li>Es werden nur Aktivitäten übernommen, die Garmin nach deiner Kontoverknüpfung an UHL übermittelt. Ältere Wanderungen werden nicht nachträglich importiert.</li>
              <li>Eine Wanderung muss mindestens 10 km lang sein. Kürzere Wanderungen zählen ebenfalls, wenn sie mindestens 600 positive Höhenmeter aufweisen.</li>
              <li>Deine Garmin-Messwerte werden automatisch übernommen und können nicht manuell verändert werden.</li>
              <li>Du kannst die Garmin-Verbindung jederzeit in deinem Account wieder trennen.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-lg">
              Warum zählt nur die Gesamtzeit und nicht die Gehzeit?
            </h2>
            <p className="text-stone-400 mt-2">
              Die Gesamtzeit ist entscheidend, weil sie die tatsächliche Leistung einer
              Wanderung widerspiegelt.
            </p>
            <p className="text-stone-400 mt-2">
              Pausen gehören zum Leistungsspektrum dazu – egal ob Verpflegung, Erholung
              oder kurze Stopps. Wer seine Kräfte besser einteilt und effizient pausiert,
              ist im Vorteil.
            </p>
            <p className="text-stone-400 mt-2">
              Die reine Gehzeit („Zeit in Bewegung“) würde das Ergebnis verfälschen, da
              sie wichtige Faktoren der Ausdauerleistung ausblendet.
            </p>
            <p className="text-stone-400 mt-2">
              👉 Deshalb gilt in der Ultimate Hiking League immer die Gesamtzeit von
              Start bis Ziel.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">Muss ich die Sekunden der Gesamtzeit mit angeben?</h2>
            <p className="text-stone-400 mt-2">
              Nein. Bitte nur Stunden und Minuten angeben.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">Was passiert nach meiner Eintragung?</h2>
            <p className="text-stone-400 mt-2">
              Deine Wanderung wird geprüft und danach in deinem Profil
              und im Ranking angezeigt.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">Kann ich auch Wanderungen aus dem Vorjahr angeben?</h2>
            <p className="text-stone-400 mt-2">
              Nein. Wir berücksichtigen nur Einträge aus der aktuellen Saison/Kalenderjahr.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">Warum taucht meine Wanderung nicht in meiner Timeline auf?</h2>
            <p className="text-stone-400 mt-2">
              Wahrscheinlich verstößt sie gegen eine unserer Ligaregeln. Checke dazu die Adminnotiz oder deine Emails.
              Bitte auch im Spamordner nachsehen.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-lg">Was ist der Unterschied zu anderen Apps?</h2>
            <p className="text-stone-400 mt-2">
              Andere Apps zeigen einzelne Aktivitäten.
              Die Liga zeigt dir deine gesamte Leistung – alles auf einen Blick.
            </p>
          </div>

        </div>
      </div>
    </main>
  )
}