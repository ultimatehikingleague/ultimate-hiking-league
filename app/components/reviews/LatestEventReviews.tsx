import Link from '@/i18n/prototype/LocalizedLink'
import type { LatestEventReview } from '@/app/lib/event-reviews'
import { reviewCopy } from '@/app/lib/review-copy'
import { ReviewScore } from './ReviewDisplay'

const messages: Record<string, { title: string; subtitle: string; ranking: string }> = {
  de: { title: 'Neueste Bewertungen', subtitle: 'Echte Erfahrungen aus unserer Hiking Community.', ranking: 'Zum Veranstaltungsranking' },
  en: { title: 'Latest reviews', subtitle: 'Real experiences from our hiking community.', ranking: 'View event rankings' },
  fr: { title: 'Derniers avis', subtitle: 'Des expériences authentiques de notre communauté de randonnée.', ranking: 'Voir le classement des événements' },
  nl: { title: 'Nieuwste beoordelingen', subtitle: 'Echte ervaringen uit onze wandelcommunity.', ranking: 'Naar het evenementenklassement' },
  pl: { title: 'Najnowsze opinie', subtitle: 'Prawdziwe doświadczenia naszej społeczności piechurów.', ranking: 'Zobacz ranking wydarzeń' },
  it: { title: 'Ultime recensioni', subtitle: 'Esperienze autentiche della nostra comunità di escursionisti.', ranking: 'Vai alla classifica degli eventi' },
  es: { title: 'Últimas reseñas', subtitle: 'Experiencias reales de nuestra comunidad senderista.', ranking: 'Ver la clasificación de eventos' },
  cs: { title: 'Nejnovější hodnocení', subtitle: 'Skutečné zkušenosti naší turistické komunity.', ranking: 'Zobrazit žebříček akcí' },
}

export default function LatestEventReviews({ rows, locale }: { rows: LatestEventReview[]; locale: string }) {
  if (!rows.length) return null
  const copy = messages[locale] ?? messages.en
  return (
    <section aria-labelledby="latest-event-reviews" className="rounded-[2rem] border border-white/10 bg-gradient-to-b from-[#26231f] to-[#1c1a17] p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
      <div className="mb-5">
        <h3 id="latest-event-reviews" className="text-xl font-bold text-white">{copy.title}</h3>
        <p className="mt-1 text-sm text-stone-400">{copy.subtitle}</p>
      </div>
      <ul className="space-y-3">
        {rows.map(row => (
          <li key={row.id}>
            <Link href={`/events/${encodeURIComponent(row.event_slug)}#reviews`} className="block rounded-2xl border border-amber-400/15 bg-black/10 px-4 py-3 transition hover:border-amber-300/40 hover:bg-amber-400/5 focus-visible:outline-2 focus-visible:outline-amber-300">
              <p className="break-words text-sm font-semibold text-white">
                {row.country_code && /^[A-Z]{2}$/i.test(row.country_code) && (
                  <span aria-hidden="true" className="me-2">{String.fromCodePoint(...[...row.country_code.toUpperCase()].map(letter => 127397 + letter.charCodeAt(0)))}</span>
                )}
                {row.event_name}
              </p>
              <p className="mt-0.5 break-words text-xs text-stone-400">{row.organizer_name}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <ReviewScore score={row.score} locale={locale} />
                <span className="text-emerald-300"><span aria-hidden="true">✓ </span>{reviewCopy(locale).verified}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/leaderboard/event-reviews" className="mt-6 inline-block rounded-2xl bg-stone-100 px-5 py-3 text-sm font-medium text-stone-950 transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-2 focus-visible:outline-amber-300">
        {copy.ranking}
      </Link>
    </section>
  )
}
