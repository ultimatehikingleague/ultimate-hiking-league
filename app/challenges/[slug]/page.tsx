import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { CalendarDays, Trophy, CircleCheck } from 'lucide-react'
import BrandHeader from '../../components/BrandHeader'
import ChristmasChallengeJoin from '../../components/ChristmasChallengeJoinButton'


type PageProps = {
  params: Promise<{
    slug: string
  }>
}

function countryToFlag(countryCode: string | null) {
  if (!countryCode) return '—'

  const code = countryCode.trim().toUpperCase()

  if (code.length !== 2) return '—'

  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  )
}

function getRankDisplay(rank: number) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'

  return `#${rank}`
}

export default async function ChallengePage({ params }: PageProps) {
  const { slug } = await params

  const { data: challenge, error } = await supabase
    .from('challenges')
    .select(
      'id, slug, title, description, registration_start, registration_end, challenge_start, challenge_end, min_distance_km, status'
    )
    .eq('slug', slug)
    .single()

  if (error || !challenge || challenge.status === 'archived') {
    notFound()
  }

  const { data: participantRows } = await supabase
    .from('challenge_participants')
    .select('hiker_id')
    .eq('challenge_id', challenge.id)

  const participantIds =
    participantRows?.map((participant) => participant.hiker_id) ?? []

  const { data: participantHikers } =
    participantIds.length > 0
      ? await supabase
          .from('hikers')
          .select('id, display_name, country, profile_status')
          .in('id', participantIds)
          .eq('profile_status', 'active')
      : { data: [] }

  const { data: challengeRecords } =
    participantIds.length > 0
      ? await supabase
          .from('records')
          .select(
            'id, hiker_id, distance_km, activity_date, elevation_gain, record_status'
            )
          .in('hiker_id', participantIds)
          .gte('activity_date', challenge.challenge_start)
          .lte('activity_date', challenge.challenge_end)
          .gte('distance_km', challenge.min_distance_km)
          .in('record_status', [
            'verified',
            'verified_admin_submission',
            'verified_elapsed',
          ])
      : { data: [] }

  const challengeStatsByHiker = new Map<
  number,
  {
    challenge_km: number
    activity_count: number
    longest_activity: number
    elevation_gain: number
    final_record_date: string
  }
>()

challengeRecords?.forEach((record) => {
  const current = challengeStatsByHiker.get(record.hiker_id) ?? {
    challenge_km: 0,
    activity_count: 0,
    longest_activity: 0,
    elevation_gain: 0,
    final_record_date: '',
  }

  const recordKm =
    typeof record.distance_km === 'number' ? record.distance_km : 0

  const recordElevation =
    typeof record.elevation_gain === 'number' ? record.elevation_gain : 0

  current.challenge_km += recordKm
  current.activity_count += 1
  current.longest_activity = Math.max(current.longest_activity, recordKm)
  current.elevation_gain += recordElevation

  if (
    !current.final_record_date ||
    record.activity_date > current.final_record_date
    ) {
    current.final_record_date = record.activity_date
    }

  challengeStatsByHiker.set(record.hiker_id, current)
})

const challengeRanking = (participantHikers ?? [])
  .map((participant) => {
    const stats = challengeStatsByHiker.get(participant.id)

    return {
      ...participant,
      challenge_km: stats?.challenge_km ?? 0,
      activity_count: stats?.activity_count ?? 0,
      longest_activity: stats?.longest_activity ?? 0,
      elevation_gain: stats?.elevation_gain ?? 0,
      final_record_date: stats?.final_record_date ?? '',
    }
  })
  .sort((a, b) => {
    // 1. Höchste Gesamtdistanz
    if (b.challenge_km !== a.challenge_km) {
      return b.challenge_km - a.challenge_km
    }

    // 2. Bei Gleichstand: weniger gewertete Aktivitäten
    if (a.activity_count !== b.activity_count) {
      return a.activity_count - b.activity_count
    }

    // 3. Danach: längste einzelne gewertete Aktivität
    if (b.longest_activity !== a.longest_activity) {
      return b.longest_activity - a.longest_activity
    }

    // 4. Danach: Endstand früher erreicht
    if (a.final_record_date !== b.final_record_date) {
      return a.final_record_date.localeCompare(b.final_record_date)
    }


    // 5. Letzter Tie-Breaker: mehr verifizierte Höhenmeter
    if (b.elevation_gain !== a.elevation_gain) {
      return b.elevation_gain - a.elevation_gain
    }

    return 0
  })

  return (
    <main className="min-h-screen bg-[#141312] text-stone-100">
      <section
            className="relative overflow-hidden border-b border-white/10"
            style={{
                backgroundImage:
                "linear-gradient(to bottom, rgba(20,19,18,0.18), rgba(20,19,18,0.82)), url('/christmas-challenge-2026-hero.png')",
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
                ← Zurück zur Startseite
                </Link>

                <div className="mt-8 max-w-4xl rounded-[2rem] border border-white/15 bg-black/35 p-6 shadow-2xl shadow-black/30 backdrop-blur-sm md:p-8">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-amber-200">
                <span className="text-base">✦</span>
                Christmas Special
                </div>

                <h1 className="mt-3 text-3xl font-bold text-white md:text-5xl">
                Christmas Challenge 2026
                </h1>

                <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-300 md:text-base">
                Sammle vom 20. Oktober bis 15. Dezember so viele verifizierte Kilometer
                wie möglich. Wer am Ende die meisten Kilometer erreicht, gewinnt.
                </p>

                <div className="mt-7 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                        <CalendarDays size={20} strokeWidth={1.8} />
                    </div>

                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                        Zeitraum
                        </div>
                        <div className="mt-1 font-semibold text-white">
                        20. Okt. – 15. Dez.
                        </div>
                    </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200">
                        <Trophy size={20} strokeWidth={1.8} />
                    </div>

                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200/70">
                        Hauptpreis
                        </div>
                        <div className="mt-1 font-semibold text-white">
                        Garmin Venu Sq
                        </div>
                    </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.05] p-4 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
                        <CircleCheck size={20} strokeWidth={1.8} />
                    </div>

                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200/70">
                        Teilnahme
                        </div>
                        <div className="mt-1 font-semibold text-white">
                        Kostenlos
                        </div>
                        <div className="mt-0.5 text-xs text-stone-400">
                        Anmeldung bis 19. Oktober
                        </div>
                    </div>
                    </div>
                        </div>
                </div>

                <div className="mt-6 flex justify-center">
                  <ChristmasChallengeJoin
                    challengeId={challenge.id}
                    challengeStatus={challenge.status}
                    />
                </div>

              </div>
            </div>
      </section>

      <section className="bg-[#141312] px-6 py-10 md:px-10 md:py-12">
        <div className="mx-auto max-w-6xl">
          <section>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Challenge-Rangliste
                </h2>

                <p className="mt-1 text-sm text-stone-400">
                  Alle angemeldeten Hiker der Christmas Challenge 2026.
                </p>
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Trophy
                    size={15}
                    strokeWidth={1.8}
                    className="text-amber-200"
                    />

                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
                    Ranking
                    </span>
                </div>

                <div className="text-xs uppercase tracking-[0.18em] text-stone-400">
                    {challengeRanking.length}{' '}
                    {challengeRanking.length === 1 ? 'Teilnehmer' : 'Teilnehmer'}
                </div>
                </div>

            <div className="space-y-3">
              {challengeRanking.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-stone-400">
                  Noch keine Teilnehmer angemeldet.
                </div>
              ) : (
                challengeRanking.map((participant, index) => {
                  const rank = index + 1

                  return (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between rounded-2xl border border-white/15 bg-black/30 px-5 py-4 shadow-lg shadow-black/20 backdrop-blur-md transition hover:border-white/25 hover:bg-black/40"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="w-12 text-center text-xl font-bold text-white">
                          {getRankDisplay(rank)}
                        </div>

                        <div className="min-w-0">
                          <Link
                            href={`/${participant.id}`}
                            className="truncate font-semibold text-white transition hover:text-stone-300"
                          >
                            {participant.display_name ?? 'Unbekannt'}
                          </Link>

                          <div className="mt-1 text-sm text-stone-400">
                            {countryToFlag(participant.country)}{' '}
                            {participant.country ?? '—'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-lg font-bold text-white">
                          {participant.challenge_km.toLocaleString('de-DE', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          km
                        </div>

                        <div className="text-xs text-stone-400">
                          Christmas Challenge
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
                       </div>
          </section>

          <section className="mt-12 border-t border-white/10 pt-10">
            <div className="max-w-4xl">
              <div className="mb-6">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                  Christmas Challenge 2026
                </div>

                <h2 className="mt-2 text-2xl font-bold text-white">
                  Regeln & Teilnahmebedingungen
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-400">
                  Mit der Teilnahme an der Christmas Challenge 2026 gelten die
                  folgenden Regeln und Teilnahmebedingungen.
                </p>
              </div>

              <div className="space-y-3">
                <details className="group rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                  <summary className="cursor-pointer list-none font-semibold text-white">
                    1. Teilnahme & Anmeldung
                  </summary>

                  <div className="mt-4 space-y-3 text-sm leading-6 text-stone-300">
                    <p>
                      Die Teilnahme ist kostenlos und setzt ein persönliches
                      Liga-Profil bei der Ultimate European Hiking League voraus.
                    </p>

                    <p>
                      Die Anmeldung zur Christmas Challenge ist bis einschließlich
                      <strong className="text-white"> 19. Oktober 2026</strong>{' '}
                      möglich. Die Challenge beginnt am{' '}
                      <strong className="text-white">20. Oktober 2026</strong> und
                      endet am{' '}
                      <strong className="text-white">15. Dezember 2026</strong>.
                    </p>

                    <p>
                      Eine Anmeldung nach Beginn der Challenge ist nicht möglich.
                      Mit der Anmeldung nimmt das Liga-Profil verbindlich an der
                      Challenge teil. Eine nachträgliche Abmeldung ist nicht
                      vorgesehen.
                    </p>
                  </div>
                </details>

                <details className="group rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                  <summary className="cursor-pointer list-none font-semibold text-white">
                    2. Gewertete Kilometer
                  </summary>

                  <div className="mt-4 space-y-3 text-sm leading-6 text-stone-300">
                    <p>
                      Für die Challenge zählen verifizierte Wanderungen mit einem
                      Aktivitätsdatum zwischen dem 20. Oktober und 15. Dezember
                      2026 einschließlich.
                    </p>

                    <p>
                      Eine gewertete Aktivität muss mindestens{' '}
                      <strong className="text-white">10 Kilometer</strong>{' '}
                      umfassen und den regulären Nachweis- und
                      Verifizierungsanforderungen der Ultimate European Hiking
                      League entsprechen.
                    </p>

                    <p>
                      Die Wanderung muss spätestens am{' '}
                      <strong className="text-white">
                        15. Dezember 2026
                      </strong>{' '}
                      vollständig eingereicht und verifiziert worden sein.
                      Nachträgliche Einreichungen oder Verifizierungen werden für
                      die Christmas Challenge nicht berücksichtigt – auch dann
                      nicht, wenn die Wanderung innerhalb des Challenge-Zeitraums
                      stattgefunden hat.
                    </p>

                    <p>
                      Die Kilometer werden nicht separat für die Challenge
                      eingereicht. Ein regulär eingereichter und rechtzeitig
                      verifizierter Liga-Eintrag wird automatisch berücksichtigt,
                      sofern er die Challenge-Bedingungen erfüllt. Die Kilometer
                      zählen gleichzeitig weiterhin für die regulären
                      UHL-Wertungen.
                    </p>
                  </div>
                </details>

                <details className="group rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                  <summary className="cursor-pointer list-none font-semibold text-white">
                    3. Rangliste
                  </summary>

                  <div className="mt-4 space-y-3 text-sm leading-6 text-stone-300">
                    <p>
                      Alle angemeldeten Teilnehmer werden in der öffentlichen
                      Challenge-Rangliste geführt und starten mit 0,00 Kilometern.
                    </p>

                    <p>
                      Die Platzierung richtet sich nach der Summe aller während
                      des Challenge-Zeitraums gültigen und verifizierten
                      Challenge-Kilometer.
                    </p>

                    <p>
                      Es gibt keine Mindestgesamtleistung. Auch Teilnehmer ohne
                      gewertete Kilometer bleiben Bestandteil der Rangliste.
                    </p>
                  </div>
                </details>

                <details className="group rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                  <summary className="cursor-pointer list-none font-semibold text-white">
                    4. Gleichstand
                  </summary>

                  <div className="mt-4 space-y-3 text-sm leading-6 text-stone-300">
                    <p>
                      Erreichen zwei oder mehrere Teilnehmer exakt dieselbe
                      Gesamtdistanz, wird die Platzierung in folgender Reihenfolge
                      entschieden:
                    </p>

                    <ol className="list-decimal space-y-2 pl-5">
                      <li>
                        Geringere Anzahl gewerteter Aktivitäten.
                      </li>
                      <li>
                        Längste einzelne gewertete Aktivität.
                      </li>
                      <li>
                        Der betreffende Kilometer-Endstand wurde an einem früheren

                        Kalendertag erreicht.
                      </li>
                      <li>
                        Höhere Summe der verifizierten Höhenmeter aus allen
                        gewerteten Challenge-Aktivitäten.
                      </li>
                    </ol>

                    <p>
                      Die Gewinnerermittlung erfolgt damit anhand der
                      verifizierten Leistungen innerhalb der Challenge. Eine
                      zufällige Auslosung findet nicht statt.
                    </p>
                  </div>
                </details>

                <details className="group rounded-2xl border border-amber-300/20 bg-amber-300/[0.04] px-5 py-4">
                  <summary className="cursor-pointer list-none font-semibold text-white">
                    5. Hauptpreis
                  </summary>

                  <div className="mt-4 space-y-3 text-sm leading-6 text-stone-300">
                    <p>
                      Der Teilnehmer auf Platz 1 der endgültigen
                      Challenge-Rangliste gewinnt eine{' '}
                      <strong className="text-white">
                        neue Garmin Venu Sq in Schwarz
                      </strong>.
                    </p>

                    <p>
                      Der Gewinn wird postalisch zugesandt. Hierfür stellt der
                      Gewinner nach Abschluss der Challenge eine geeignete
                      Versandadresse zur Verfügung und stimmt deren einmaliger
                      Verarbeitung zum Zweck des Gewinnversands zu.
                    </p>

                    <p>
                      Die Versandadresse wird ausschließlich zur Abwicklung des
                      Gewinnversands verwendet und nicht öffentlich angezeigt.
                    </p>

                    <p>
                      Eine Barauszahlung oder ein Umtausch des Gewinns durch die
                      Ultimate European Hiking League ist ausgeschlossen. Nach
                      Übergabe kann der Gewinner frei über den Sachpreis verfügen.
                    </p>
                  </div>
                </details>

                <details className="group rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                  <summary className="cursor-pointer list-none font-semibold text-white">
                    6. Verifizierung & Fairness
                  </summary>

                  <div className="mt-4 space-y-3 text-sm leading-6 text-stone-300">
                    <p>
                      Für sämtliche gewerteten Aktivitäten gelten die regulären
                      Nachweis- und Verifizierungsregeln der Ultimate European
                      Hiking League.
                    </p>

                    <p>
                      Offensichtlich fehlerhafte, unvollständige oder manipulierte
                      Angaben können von der Wertung ausgeschlossen oder
                      korrigiert werden. Werden bereits gewertete Aktivitäten
                      später als ungültig erkannt, können die entsprechenden
                      Kilometer aus der Challenge-Wertung entfernt werden.
                    </p>

                    <p>
                      Bewusste Manipulationsversuche können zum Ausschluss aus der
                      Christmas Challenge führen.
                    </p>
                  </div>
                </details>

                <details className="group rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                  <summary className="cursor-pointer list-none font-semibold text-white">
                    7. Abschluss & Gewinner
                  </summary>

                  <div className="mt-4 space-y-3 text-sm leading-6 text-stone-300">
                    <p>
                      Die Christmas Challenge endet am 15. Dezember 2026. Danach
                      wird die Rangliste abschließend geprüft und der Endstand
                      festgestellt.
                    </p>

                    <p>
                      Nach Challenge-Ende können keine zusätzlichen Kilometer mehr
                      in die Wertung aufgenommen werden. Maßgeblich für die
                      Gewinnvergabe ist die anschließend festgestellte endgültige
                      Rangliste.
                    </p>

                    <p>
                      Der Gewinner wird über die bei seinem Liga-Account
                      hinterlegten Kontaktmöglichkeiten benachrichtigt und zur
                      Bereitstellung einer Versandadresse aufgefordert.
                    </p>

                    <p>
                      Meldet sich der Gewinner trotz Benachrichtigung innerhalb
                      von 14 Tagen nicht zurück oder stellt keine für den Versand
                      erforderliche Adresse zur Verfügung, kann der Gewinn an den
                      nach diesen Regeln nächstplatzierten Teilnehmer übergehen.
                    </p>
                  </div>
                </details>

                <details className="group rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                  <summary className="cursor-pointer list-none font-semibold text-white">
                    8. Öffentliche Darstellung
                  </summary>

                  <div className="mt-4 space-y-3 text-sm leading-6 text-stone-300">
                    <p>
                      Mit der Teilnahme erklärt sich der Teilnehmer damit
                      einverstanden, dass sein öffentliches Liga-Profil während
                      der Challenge mit Anzeigename, Länderzuordnung, Platzierung
                      und gewerteten Challenge-Kilometern in der öffentlich
                      einsehbaren Challenge-Rangliste dargestellt wird.
                    </p>

                    <p>
                      Weitere personenbezogene Daten, insbesondere
                      E-Mail-Adressen und Versandadressen, werden dadurch nicht
                      veröffentlicht.
                    </p>
                  </div>
                </details>

                <details className="group rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
                  <summary className="cursor-pointer list-none font-semibold text-white">
                    9. Änderungen & außergewöhnliche Umstände
                  </summary>

                  <div className="mt-4 space-y-3 text-sm leading-6 text-stone-300">
                    <p>
                      Die Ultimate European Hiking League behält sich vor, die
                      Challenge bei technischen Problemen, höherer Gewalt oder
                      anderen außergewöhnlichen Umständen anzupassen, zu
                      unterbrechen oder vorzeitig zu beenden, sofern eine
                      ordnungsgemäße Durchführung andernfalls nicht möglich ist.
                    </p>

                    <p>
                      Bereits laufende Wertungsregeln werden nicht nachträglich
                      willkürlich verändert. Notwendige Änderungen werden
                      transparent kommuniziert und sollen alle Teilnehmer
                      möglichst gleich behandeln.
                    </p>
                  </div>
                </details>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}