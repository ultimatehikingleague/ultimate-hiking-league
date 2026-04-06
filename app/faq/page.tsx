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
            <h2 className="font-semibold text-lg">Was passiert nach meiner Eintragung?</h2>
            <p className="text-stone-400 mt-2">
              Deine Wanderung wird geprüft und danach in deinem Profil
              und im Ranking angezeigt.
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