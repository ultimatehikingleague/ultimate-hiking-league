import { useTranslations } from 'next-intl'

export default function PartnershipFooter() {
  const t = useTranslations('ui')
  return (
    <section className="border-t border-white/10 bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white md:text-3xl">{t("partnerships")}</h2>
          <p className="mt-2 text-sm text-stone-400 md:text-base">{t("partnershipAudience")}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10">
            <h3 className="text-xl font-bold text-white">{t("eventOrganisers")}</h3>

            <p className="mt-3 text-sm leading-6 text-stone-400">{t("listEvent")}</p>

            <p className="mt-4 text-sm font-medium text-stone-200">{t("eventSubmissionInfo")}</p>

            <ul className="mt-3 space-y-2 text-sm text-stone-400">
              <li>{t("bulletEventName")}</li>
              <li>{t("bulletDate")}</li>
              <li>{t("bulletLocation")}</li>
              <li>{t("bulletDistances")}</li>
              <li>{t("bulletRegistration")}</li>
            </ul>

            <p className="mt-4 text-sm leading-6 text-stone-400">{t("customEventDescriptions")}</p>

            <a
              href="mailto:ultimatehikingleague@gmail.com?subject=Eventeinreichung"
              className="mt-6 inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-stone-100 transition hover:bg-white/10"
            >{t("submitEvent")}</a>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10">
            <h3 className="text-xl font-bold text-white">{t("brandPartners")}</h3>

            <p className="mt-3 text-sm leading-6 text-stone-400">{t("sportsAudience")}</p>

            <p className="mt-4 text-sm font-medium text-stone-200">{t("availablePlacements")}</p>

            <ul className="mt-3 space-y-2 text-sm text-stone-400">
              <li>{t("bulletHome")}</li>
              <li>{t("bulletRankings")}</li>
              <li>{t("bulletEvents")}</li>
              <li>{t("bulletProfiles")}</li>
              <li>{t("bulletPartners")}</li>
            </ul>

            <p className="mt-4 text-sm leading-6 text-stone-400">{t("mediaInformation")}</p>

            <a
              href="mailto:ultimatehikingleague@gmail.com?subject=Werbepartnerschaft"
              className="mt-6 inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-stone-100 transition hover:bg-white/10"
            >{t("askPartnership")}</a>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-xl shadow-black/10">
            <h3 className="text-xl font-bold text-white">{t("seasonPartners")}</h3>

            <p className="mt-3 text-sm leading-6 text-stone-400">{t("supportTheSeason")}</p>

            <p className="mt-4 text-sm font-medium text-stone-200">{t("weAreLooking")}</p>

            <ul className="mt-3 space-y-2 text-sm text-stone-400">
              <li>{t("bulletPrizes")}</li>
              <li>{t("bulletVouchers")}</li>
              <li>{t("bulletTickets")}</li>
              <li>{t("bulletGoods")}</li>
              <li>{t("bulletSeason")}</li>
            </ul>

            <p className="mt-4 text-sm leading-6 text-stone-400">{t("informationOnRequest")}</p>

            <a
              href="mailto:ultimatehikingleague@gmail.com?subject=Saisonpartnerschaft"
              className="mt-6 inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-stone-100 transition hover:bg-white/10"
            >{t("becomeSeasonPartner")}</a>
          </div>
        </div>

        <div className="mt-6 text-sm text-stone-500">{t("pricingOnRequest")}</div>
      </div>
    </section>
  )
}