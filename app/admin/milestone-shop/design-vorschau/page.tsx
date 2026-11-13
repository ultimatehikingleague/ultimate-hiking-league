import Link from 'next/link'
import { notFound } from 'next/navigation'
import PartnerBenefitCards from '../../../milestone-shop/PartnerBenefitCards'
import type { PartnerBenefit } from '../../../milestone-shop/PartnerBenefitCards'

const examples: PartnerBenefit[] = [
  {
    id: 1, partner_name: 'heat it®', title: '15 % Rabatt auf alle Produkte',
    reward_type: 'benefit', shared_code: 'DEMO15', description: 'Ohne Mindestbestellwert.',
    redemption_instructions: 'Ein gemeinsamer Rabattcode für die Community.',
    redemption_url: 'https://example.com', image_url: null, is_active: false,
  },
  {
    id: 2, partner_name: 'Extremwandershop', title: '10 % Rabatt auf deinen Einkauf',
    reward_type: 'affiliate', shared_code: 'DEMO10', description: 'Outdoor-Ausrüstung für deine nächste Tour.',
    redemption_instructions: null, redemption_url: 'https://example.com',
    image_url: null, is_active: false,
  },
  {
    id: 3, partner_name: 'Outdooractive', title: '5 € auf Pro oder 10 € auf Pro+',
    reward_type: 'affiliate', shared_code: null, description: 'Rabatt auf ein kostenpflichtiges Jahresabo.',
    redemption_instructions: null, redemption_url: 'https://example.com',
    image_url: null, is_active: false,
  },
]

export default function LocalDesignPreview() {
  if (process.env.NODE_ENV !== 'development') notFound()

  return (
    <main className="min-h-screen bg-[#080d16] py-10 text-white">
      <div className="mx-auto mb-8 max-w-7xl px-5 md:px-10">
        <Link href="/admin/milestone-shop" className="text-sm text-cyan-300">← Zur Milestone-Verwaltung</Link>
        <h1 className="mt-4 text-2xl font-bold">Lokale Designvorschau</h1>
        <p className="mt-2 text-sm text-slate-300">Beispieldaten mit Demo-Codes. Die Angebotslinks sind deaktiviert.</p>
      </div>
      <PartnerBenefitCards benefits={examples} preview />
      <div className="mx-auto max-w-7xl px-5 md:px-10">
        <section aria-label="Beispielprämie" className="mt-6 max-w-sm rounded-2xl border border-white/10 bg-[#141d28] p-5">
          <p className="text-sm text-slate-300">Einlösbare Milestone-Prämie</p>
          <p className="mt-2 text-lg font-bold">Freistart für die Burgenland Extrem Tour</p>
          <p className="mt-2 font-semibold text-cyan-300">300 Milestones</p>
        </section>
      </div>
    </main>
  )
}
