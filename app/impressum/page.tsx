export default function ImpressumPage() {
  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-white">Impressum</h1>

        <div className="mt-6 space-y-4 text-sm text-stone-300 leading-6">
          <p>Angaben gemäß § 5 TMG</p>

          <p>
            Ultimate Hiking League<br />
            Philipp Dobrinski<br />
            Ansbacher Straße 4a<br />
            91452 Wilhermsdorf<br />
            Deutschland
          </p>

          <p>
            E-Mail: ultimatehikingleague@gmail.com
          </p>

          <p>
            Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV:
          </p>

          <p>
            Philipp Dobrinski<br />
            Anschrift wie oben
          </p>
        </div>
      </div>
    </main>
  )
}