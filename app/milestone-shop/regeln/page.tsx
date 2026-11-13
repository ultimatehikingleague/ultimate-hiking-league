import Link from 'next/link'

export default function MilestoneRulesPage() {
  return <main className="min-h-screen bg-[#080d16] px-6 py-12 text-slate-300 md:px-10">
    <div className="mx-auto max-w-4xl">
      <Link href="/milestone-shop" className="text-sm text-cyan-300 hover:text-white">← Zum Milestone-Shop</Link>
      <p className="mt-10 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">ULTIMATE MILESTONE SHOP</p>
      <h1 className="mt-4 text-3xl font-bold text-white md:text-5xl">Milestone-Regeln &amp; Einlösung</h1>
      <p className="mt-5 leading-7">Hier erfährst du, wie der Milestone-Shop funktioniert und wer bei Fragen zur Einlösung dein Ansprechpartner ist.</p>

      <section id="sammeln" className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-7">
        <h2 className="text-2xl font-bold text-white">Milestones sammeln</h2>
        <p className="mt-4 leading-7">Milestones werden für anrechenbare, verifizierte Wanderleistungen gutgeschrieben. Dein verfügbares Guthaben findest du in deinem Hiker-Profil und im Milestone-Shop.</p>
        <p className="mt-4 leading-7">Der Faktor richtet sich nach der Distanz der einzelnen Wanderung, nicht nach deinen insgesamt gesammelten Kilometern.</p>
        <p className="mt-4 leading-7">Es zählt die im verifizierten Record gespeicherte Distanz. Für die Berechnung werden zuerst die Nachkommastellen der Kilometer abgeschnitten. Anschließend werden die vollen Kilometer mit dem Faktor multipliziert; ein dabei verbleibender halber Milestone wird ebenfalls abgerundet.</p>
        <p className="mt-4 leading-7">Die Faktorstufe wird anhand der gespeicherten Distanz bestimmt: Ab genau 30 km gilt Faktor 1,5, ab genau 100 km Faktor 2. Der Faktor gilt für die gesamten vollen Kilometer dieser Wanderung.</p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-3 text-left font-semibold text-white">Milestone-Faktoren pro anrechenbarer Wanderung</caption>
            <thead className="border-b border-white/15 text-white"><tr><th scope="col" className="py-3 pr-4">Distanz</th><th scope="col" className="py-3 pr-4">Faktor</th><th scope="col" className="py-3">Beispiel</th></tr></thead>
            <tbody className="divide-y divide-white/10">
              <tr><td className="py-3 pr-4">Unter 30 km</td><td className="py-3 pr-4">× 1</td><td className="py-3">29,9 km → 29 Milestones</td></tr>
              <tr><td className="py-3 pr-4">Ab 30 bis unter 100 km</td><td className="py-3 pr-4">× 1,5</td><td className="py-3">30,9 km → 45 Milestones</td></tr>
              <tr><td className="py-3 pr-4">Ab 100 km</td><td className="py-3 pr-4">× 2</td><td className="py-3">100,9 km → 200 Milestones</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4 leading-7">Weitere Beispiele: 31 km ergeben 46 Milestones (31 × 1,5 = 46,5, abgerundet auf 46). 99,9 km ergeben 148 Milestones (99 × 1,5 = 148,5, abgerundet auf 148). Genau 100 km ergeben 200 Milestones.</p>
        <p className="mt-4 leading-7">Die sportlichen Voraussetzungen für Records und deren Prüfung findest du in den <Link href="/rules" className="text-cyan-300 underline underline-offset-4">Ligaregeln</Link>.</p>
      </section>

      <section id="einloesen" className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-7">
        <h2 className="text-2xl font-bold text-white">Milestones gegen einen Code einlösen</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 leading-7">
          <li>Melde dich mit deinem Konto an. Für die Einlösung benötigst du ein beanspruchtes, aktives Hiker-Profil und ausreichend Milestones.</li>
          <li>Wähle ein verfügbares Angebot. Bei erfolgreicher Einlösung werden die angezeigten Milestones abgezogen und dir wird ein individueller Code zugeteilt.</li>
          <li>Deinen zugeteilten Code findest du dauerhaft unter <Link href="/account/rewards" className="text-cyan-300 underline underline-offset-4">Meine Belohnungen</Link>. Diese Zuteilung bedeutet noch nicht, dass du den Code beim Händler eingelöst hast.</li>
          <li>Löse den Code beim genannten Händler entsprechend den Einlösehinweisen und Angebotsbedingungen ein.</li>
        </ol>
        <p className="mt-4 leading-7">Angebote sind nur im Rahmen des verfügbaren Codebestands einlösbar. Ist kein freier Code vorhanden, wird das Angebot als ausverkauft angezeigt. Eine fehlgeschlagene Einlösung ohne Codezuteilung zieht keine Milestones ab.</p>
      </section>

      <section id="haendler" className="mt-6 rounded-3xl border border-cyan-400/20 bg-cyan-400/[0.04] p-7">
        <h2 className="text-2xl font-bold text-white">Wer ist für die Gutscheinleistung verantwortlich?</h2>
        <p className="mt-4 leading-7">Anbieter der im jeweiligen Angebot beschriebenen Gutschein- oder Rabattleistung ist der dort genannte Händler. Er ist für die Annahme und Einlösung des Codes sowie für die von ihm zugesagten Waren, Rabatte und Leistungen verantwortlich.</p>
        <p className="mt-4 leading-7">ULTIMATE Hiking League betreibt das Milestone-System und verwaltet das Guthaben sowie die Zuteilung der Partnercodes. ULTIMATE erbringt die vom Händler angebotene Leistung nicht selbst.</p>
        <p className="mt-4 leading-7">Beachte die beim Angebot angegebenen Bedingungen, insbesondere Gültigkeitsdauer, Mindestbestellwert, ausgeschlossene Artikel und mögliche Versandkosten. Es gelten die für das jeweilige Angebot ausgewiesenen Bedingungen und die gesetzlichen Rechte.</p>
        <p className="mt-4 leading-7">Bei Problemen mit der Annahme eines Codes oder mit einer Händlerleistung wende dich zunächst an den genannten Händler. Bei Problemen mit deinem Milestone-Guthaben oder der Codezuteilung wende dich an <Link href="/kontakt" className="text-cyan-300 underline underline-offset-4">ULTIMATE</Link>. Wird ein zugeteilter Code nicht akzeptiert, kannst du uns den Vorgang zur Prüfung melden.</p>
        <p className="mt-4 leading-7">Diese Aufgabenverteilung schließt eine gesetzliche Haftung von ULTIMATE für eigene Pflichtverletzungen nicht aus. Zwingende gesetzliche Ansprüche bleiben unberührt.</p>
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-7">
        <h2 className="text-2xl font-bold text-white">Datenschutz</h2>
        <p className="mt-4 leading-7">Für Guthaben und Codezuteilung verarbeiten wir deine Profilzuordnung, Punktebuchungen und Einlösedaten. Einzelheiten findest du in der <Link href="/datenschutz#milestone-shop" className="text-cyan-300 underline underline-offset-4">Datenschutzerklärung zum Milestone-Shop</Link>. Für die Verarbeitung auf der Website des Händlers gelten dessen Datenschutzhinweise.</p>
      </section>
    </div>
  </main>
}
