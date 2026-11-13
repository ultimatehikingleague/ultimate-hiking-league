import Link from 'next/link'

export default function DisclaimerPage() {
  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
          Disclaimer
        </h1>

        <p className="mt-4 text-stone-400">
          Hinweise zu externen Links und Inhalten Dritter.
        </p>

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 shadow-xl shadow-black/10">
          <div className="space-y-6 text-sm leading-7 text-stone-300">
            <p>
              Diese Website enthält Links zu externen Websites Dritter, auf deren
              Inhalte wir keinen Einfluss haben.
            </p>

            <p>
              Für die Inhalte der verlinkten Seiten sind ausschließlich deren
              jeweilige Betreiber verantwortlich.
            </p>

            <p>
              Zum Zeitpunkt der Verlinkung wurden die externen Inhalte auf mögliche
              Rechtsverstöße geprüft. Eine permanente inhaltliche Kontrolle der
              verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer
              Rechtsverletzung nicht zumutbar.
            </p>

            <p>
              Bei Bekanntwerden von Rechtsverletzungen werden entsprechende Links
              selbstverständlich umgehend entfernt.
            </p>

            <p>
              Dies gilt auch für freiwillig hinterlegte externe Profile oder
              Social-Media-Verlinkungen von Nutzerinnen und Nutzern.
            </p>
          </div>
        </section>
        {process.env.NODE_ENV !== 'production' && (
        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
          <h2 className="text-2xl font-bold text-white">Milestone-Shop: Leistungen der Händler</h2>
          <div className="mt-4 space-y-4 text-sm leading-7 text-stone-300">
            <p>Für die Einlösung eines Partnercodes und die Erfüllung der im Angebot beschriebenen Gutschein- oder Rabattleistung ist der dort genannte Händler verantwortlich. ULTIMATE Hiking League betreibt das Milestone-System und verwaltet Guthaben und Codezuteilung.</p>
            <p>Bei technischen Problemen mit dem Milestone-Konto oder der Codezuteilung ist ULTIMATE dein Ansprechpartner. Die gesetzliche Haftung für eigene Pflichtverletzungen und zwingende gesetzliche Ansprüche bleiben unberührt.</p>
            <p>Weitere Informationen findest du unter <Link href="/milestone-shop/regeln" className="text-white underline underline-offset-4">Milestone-Regeln &amp; Einlösung</Link>.</p>
          </div>
        </section>
        )}
      </div>
    </main>
  );
}