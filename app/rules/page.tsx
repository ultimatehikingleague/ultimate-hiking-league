'use client'

import Link from 'next/link'
import BrandHeader from '../components/BrandHeader'

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10 backdrop-blur-sm md:p-8">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-7 text-stone-300">
        {children}
      </div>
    </section>
  )
}

function RuleList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={index} className="flex gap-3">
          <span className="mt-1 text-stone-500">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function RulesPage() {
  return (
    <main className="min-h-screen bg-[#141312] text-stone-100">
      <section
        className="relative overflow-hidden border-b border-white/10"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(20,19,18,0.30), rgba(20,19,18,0.85)), url('/leaderboard-hero.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="mx-auto max-w-6xl px-6 py-12 md:px-10 md:py-16">
          <BrandHeader />

          <Link
            href="/"
            className="inline-block text-sm text-stone-300 transition hover:text-white"
          >
            ← Zurück
          </Link>

          <div className="mt-6 max-w-3xl rounded-[2rem] border border-white/10 bg-black/25 p-6 shadow-2xl shadow-black/20 backdrop-blur-sm md:p-8">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-300">
              Liga
            </div>

            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white md:text-5xl">
              Ligaregeln
            </h1>

            <p className="mt-3 text-sm leading-6 text-stone-300 md:text-base">
              Transparent, fair und nachvollziehbar: So werden Records,
              Divisionen, Rankings und Saisons in der Ultimate European Hiking
              League gewertet.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 md:px-10 md:py-12">
        <div className="mx-auto max-w-5xl space-y-6">
          <Section title="1. Grundprinzip der Liga">
            <p>
              Die Ultimate European Hiking League ist eine dauerhafte Rangliste
              für Langstreckenwanderer.
            </p>
            <p>
              Die allgemeine Platzierung basiert ausschließlich auf den
              insgesamt gesammelten Kilometern.
            </p>
            <p>
              Die Divisionen dienen der Einordnung des Leistungsprofils, nicht
              der Platzierung im Overall Ranking.
            </p>
          </Section>

          <Section title="2. Saisonmodell">
            <RuleList
              items={[
                <>Eine Saison entspricht dem Kalenderjahr.</>,
                <>Saisonstart ist der 01.01.</>,
                <>Saisonende ist der 31.12.</>,
                <>Zum Start einer neuen Saison wird die Saisonwertung zurückgesetzt.</>,
                <>Vergangene Saisons bleiben archiviert und sollen langfristig im Profil sichtbar bleiben.</>,
              ]}
            />
          </Section>

          <Section title="3. Was ist ein gültiger Record?">
            <p>Ein Record ist eine dokumentierte Wanderung eines Teilnehmers.</p>

            <p className="font-semibold text-white">Pflichtdaten eines Records</p>
            <RuleList
              items={[
                <>Name des Wanderers</>,
                <>Datum der Wanderung</>,
                <>Distanz in Kilometern</>,
              ]}
            />

            <p className="font-semibold text-white">Weitere wichtige Angaben</p>
            <RuleList
              items={[
                <>Gesamtzeit der Wanderung</>,
                <>Höhenmeter</>,
                <>Land</>,
                <>Event / Veranstaltungsname</>,
                <>Quelle oder Nachweis</>,
              ]}
            />

            <p className="font-semibold text-white">Mindestanforderung</p>
            <RuleList
              items={[
                <>Ein Record zählt grundsätzlich ab 10 km.</>,
                <>
                  Unter 10 km wird ein Record nur gewertet, wenn mindestens
                  600 Höhenmeter erreicht wurden.
                </>,
              ]}
            />
          </Section>

          <Section title="4. Private Wanderungen">
            <p>
              Private Wanderungen sind ausdrücklich zugelassen und zählen für
              die Gesamtkilometer eines Teilnehmers.
            </p>

            <p className="font-semibold text-white">Voraussetzungen</p>
            <RuleList
              items={[
                <>Ein privater Hike benötigt einen GPS-Track als Nachweis.</>,
                <>Die Wanderung muss mit vollständigen und plausiblen Daten eingereicht werden.</>,
              ]}
            />

            <p className="font-semibold text-white">Wichtig</p>
            <RuleList
              items={[
                <>Private Wanderungen zählen für das Overall Ranking.</>,
                <>Private Wanderungen zählen nicht für die Divisionseinstufung.</>,
                <>Private Wanderungen zählen nicht für Aufstieg oder Abstieg zwischen Divisionen.</>,
              ]}
            />
          </Section>

          <Section title="5. Offizielle Events">
            <p>
              Offizielle Events sind die Grundlage für die Leistungsbewertung
              innerhalb der Divisionen.
            </p>

            <p className="font-semibold text-white">Wichtig</p>
            <RuleList
              items={[
                <>Nur Event-Ergebnisse werden für die Divisionsbewertung herangezogen.</>,
                <>Private Wanderungen haben keinen Einfluss auf die Division.</>,
                <>
                  Bei offiziellen Events muss ein GPS-Track mindestens 97 % der
                  geforderten offiziellen Distanz erfüllen, sofern ein Track als
                  Nachweis genutzt wird.
                </>,
              ]}
            />
          </Section>

          <Section title="6. Zeitwertung">
            <p>
              Für jede Geschwindigkeitsberechnung zählt ausschließlich die echte
              Gesamtzeit der Wanderung von Start bis Ziel.
            </p>

            <RuleList
              items={[
                <>Moving Time zählt nicht.</>,
                <>Aktive Gehzeit zählt nicht.</>,
                <>Bereinigte Zeiten ohne Pausen zählen nicht.</>,
                <>
                  Für die Divisionsberechnung werden nur Events mit bestätigter
                  Gesamtzeit berücksichtigt.
                </>,
              ]}
            />
          </Section>

          <Section title="7. Divisionen und km/h-Grenzen">
            <p>
              Die Divisionen werden nach der durchschnittlichen Geschwindigkeit
              offizieller Event-Ergebnisse mit bestätigter Gesamtzeit eingeteilt.
            </p>

            <RuleList
              items={[
                <>
                  <strong>Silver Division:</strong> 0,00 bis 4,79 km/h
                </>,
                <>
                  <strong>Gold Division:</strong> 4,80 bis 5,79 km/h
                </>,
                <>
                  <strong>Platinum Division:</strong> 5,80 bis 7,50 km/h
                </>,
              ]}
            />

            <p>
              Neue Teilnehmer oder Teilnehmer ohne ausreichend bestätigte
              Event-Zeiten werden standardmäßig der Silver Division zugeordnet.
            </p>
          </Section>

          <Section title="8. Rolling-Berechnung der Division">
            <p>
              Die Division eines Teilnehmers wird dynamisch anhand der letzten
              offiziellen Event-Ergebnisse berechnet.
            </p>

            <p className="font-semibold text-white">Grundregel</p>
            <RuleList
              items={[
                <>
                  Verwendet werden nur offizielle Events mit bestätigter
                  Gesamtzeit.
                </>,
                <>Private Wanderungen werden nicht berücksichtigt.</>,
                <>
                  Grundlage für die laufende Bewertung sind die letzten 3
                  offiziellen Events.
                </>,
                <>
                  Formel: Geschwindigkeit = Distanz ÷ Gesamtzeit
                </>,
                <>
                  Rolling-Wert = Durchschnitt der Geschwindigkeiten der letzten
                  3 offiziellen Events
                </>,
              ]}
            />
          </Section>

          <Section title="9. Aufstieg und Abstieg">
            <p className="font-semibold text-white">Aufstieg</p>
            <RuleList
              items={[
                <>
                  Ein Aufstieg ist ab mindestens 3 offiziellen
                  Event-Ergebnissen möglich.
                </>,
                <>
                  Der Durchschnitt der letzten 3 offiziellen Events muss über
                  der Schwelle der nächsthöheren Division liegen.
                </>,
                <>
                  Beispiel: Für den Aufstieg von Silver nach Gold muss der
                  Rolling-Durchschnitt mindestens 4,80 km/h betragen.
                </>,
                <>
                  Für den Aufstieg von Gold nach Platinum muss der
                  Rolling-Durchschnitt mindestens 5,80 km/h betragen.
                </>,
              ]}
            />

            <p className="font-semibold text-white">Abstieg</p>
            <RuleList
              items={[
                <>
                  Ein Abstieg wird erst geprüft, wenn mindestens 5 offizielle
                  Event-Ergebnisse vorhanden sind.
                </>,
                <>
                  Dann wird der Durchschnitt der letzten 5 offiziellen Events
                  betrachtet.
                </>,
                <>
                  Liegt dieser Durchschnitt unter der Mindestgrenze der
                  aktuellen Division, erfolgt eine Rückstufung.
                </>,
                <>
                  Beispiel: Fällt ein Gold-Hiker unter 4,80 km/h, droht der
                  Abstieg in Silver.
                </>,
                <>
                  Fällt ein Platinum-Hiker unter 5,80 km/h, droht der Abstieg
                  in Gold.
                </>,
              ]}
            />
          </Section>

          <Section title="10. Ranking in der Liga">
            <p>
              Das Ranking – sowohl Overall als auch innerhalb einer Division –
              basiert ausschließlich auf den insgesamt gelaufenen Kilometern.
            </p>

            <RuleList
              items={[
                <>Geschwindigkeit beeinflusst nicht den Rangplatz.</>,
                <>Geschwindigkeit beeinflusst nur die Division.</>,
                <>Ein Silver-Hiker kann deshalb im Overall Ranking vor einem Platinum-Hiker stehen.</>,
              ]}
            />
          </Section>

          <Section title="11. Event-Struktur">
            <RuleList
              items={[
                <>Ein Event wird über Eventname, Datum, Ort und offizielle Distanz definiert.</>,
                <>Unterschiedliche Distanzen eines Events gelten als eigenständige Eventvarianten.</>,
              ]}
            />
          </Section>

          <Section title="12. Skyscraper-Ranking">
            <p>
              Zusätzlich zur kilometerbasierten Hauptliga existiert eine
              Skyscraper-Wertung für Höhenmeter.
            </p>

            <RuleList
              items={[
                <>Gezählt wird die Summe aller plausibel erfassten Höhenmeter.</>,
                <>Ein Teilnehmer wird ab insgesamt 1500 Höhenmetern innerhalb einer Saison sichtbar.</>,
                <>Das Skyscraper-Ranking basiert ausschließlich auf Höhenmetern.</>,
                <>Kilometer und km/h beeinflussen das Skyscraper-Ranking nicht.</>,
                <>Skyscraper läuft parallel zu Silver, Gold und Platinum.</>,
              ]}
            />
          </Section>

          <Section title="13. Profile claimen und Daten ergänzen">
            <p>
              Teilnehmer können bestehende Profile beanspruchen und mit ihrem
              eigenen Account verknüpfen.
            </p>

            <RuleList
              items={[
                <>Für einen Claim können Vor- und Nachname, Datum, Ort und Distanz eines Events abgefragt werden.</>,
                <>Als Nachweis können GPS-Track oder personifizierte Finisher-Nachweise verlangt werden.</>,
                <>Nach erfolgreichem Claim können Records ergänzt, Profilinformationen erweitert und Zuordnungen korrigiert werden.</>,
              ]}
            />
          </Section>

          <Section title="14. Fairness und Prüfung">
            <RuleList
              items={[
                <>Alle Daten müssen korrekt, vollständig und plausibel sein.</>,
                <>Unplausible oder manipulierte Einreichungen können abgelehnt oder entfernt werden.</>,
                <>Claims, Nachweise und Korrekturen können manuell geprüft werden.</>,
                <>Ziel der Liga ist ein faires, transparentes und nachvollziehbares Bewertungssystem.</>,
              ]}
            />
          </Section>
        </div>
      </section>
    </main>
  )
}