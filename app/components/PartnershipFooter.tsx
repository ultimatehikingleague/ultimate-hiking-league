export default function PartnershipFooter() {
  return (
    <section className="border-t border-white/10 bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            Kooperationen &amp; Partnerschaften
          </h2>
          <p className="mt-2 text-sm text-stone-400 md:text-base">
            Für Veranstalter, Marken und Partnerunternehmen.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10">
            <h3 className="text-xl font-bold text-white">Für Veranstalter</h3>

            <p className="mt-3 text-sm leading-6 text-stone-400">
              Sie möchten Ihr Event in unserer Liga listen lassen?
            </p>

            <p className="mt-4 text-sm font-medium text-stone-200">
              Für eine Aufnahme senden Sie uns bitte:
            </p>

            <ul className="mt-3 space-y-2 text-sm text-stone-400">
              <li>• Eventname</li>
              <li>• Datum</li>
              <li>• Ort / Land</li>
              <li>• angebotene Distanzen</li>
              <li>• Website / Anmeldelink</li>
              <li>• Logo (optional)</li>
            </ul>

            <p className="mt-4 text-sm leading-6 text-stone-400">
              Eventbeschreibungen übernehmen wir auf Wunsch individuell.
            </p>

            <a
              href="mailto:ultimatehikingleague@gmail.com?subject=Eventeinreichung"
              className="mt-6 inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-stone-100 transition hover:bg-white/10"
            >
              Event einreichen
            </a>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10">
            <h3 className="text-xl font-bold text-white">
              Für Marken &amp; Werbepartner
            </h3>

            <p className="mt-3 text-sm leading-6 text-stone-400">
              Sie möchten Ihre Marke in einem sportlichen, aktiven Umfeld
              präsentieren?
            </p>

            <p className="mt-4 text-sm font-medium text-stone-200">
              Mögliche Platzierungen:
            </p>

            <ul className="mt-3 space-y-2 text-sm text-stone-400">
              <li>• Startseite</li>
              <li>• Rankings</li>
              <li>• Eventseiten</li>
              <li>• Profilseiten</li>
              <li>• Partnerplatzierungen</li>
            </ul>

            <p className="mt-4 text-sm leading-6 text-stone-400">
              Individuelle Möglichkeiten und Mediadaten auf Anfrage.
            </p>

            <a
              href="mailto:ultimatehikingleague@gmail.com?subject=Werbepartnerschaft"
              className="mt-6 inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-stone-100 transition hover:bg-white/10"
            >
              Partnerschaft anfragen
            </a>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10">
            <h3 className="text-xl font-bold text-white">
              Trophy &amp; Saisonpartner
            </h3>

            <p className="mt-3 text-sm leading-6 text-stone-400">
              Sie möchten unsere Saisonwertung unterstützen?
            </p>

            <p className="mt-4 text-sm font-medium text-stone-200">
              Gesucht werden Partner für:
            </p>

            <ul className="mt-3 space-y-2 text-sm text-stone-400">
              <li>• Siegerpreise</li>
              <li>• Gutscheine</li>
              <li>• Eventtickets</li>
              <li>• Sachpreise</li>
              <li>• Saisonkooperationen</li>
            </ul>

            <p className="mt-4 text-sm leading-6 text-stone-400">
              Weitere Informationen auf Anfrage.
            </p>

            <a
              href="mailto:ultimatehikingleague@gmail.com?subject=Saisonpartnerschaft"
              className="mt-6 inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-stone-100 transition hover:bg-white/10"
            >
              Saisonpartner werden
            </a>
          </div>
        </div>

        <div className="mt-6 text-sm text-stone-500">
          Preislisten, Möglichkeiten und individuelle Pakete erhalten Sie per
          Anfrage.
        </div>
      </div>
    </section>
  )
}