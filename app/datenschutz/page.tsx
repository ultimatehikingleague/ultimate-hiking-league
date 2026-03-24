export default function DatenschutzPage() {
  return (
    <main className="min-h-screen bg-[#141312] px-6 py-12 text-stone-100 md:px-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-white">
          Datenschutzerklärung
        </h1>

        <div className="mt-6 space-y-5 text-sm text-stone-300 leading-6">
          <p>
            Der Schutz deiner persönlichen Daten ist uns wichtig. Diese Website
            verarbeitet personenbezogene Daten ausschließlich im Rahmen der
            gesetzlichen Bestimmungen (DSGVO, TMG).
          </p>

          <h2 className="text-lg font-semibold text-white">
            Verantwortlicher
          </h2>

          <p>
            Philipp Dobrinski<br />
            Ultimate Hiking League<br />
            Ansbacher Straße 4a<br />
            91452 Wilhermsdorf<br />
            Deutschland
          </p>

          <h2 className="text-lg font-semibold text-white">
            Erhebung und Speicherung personenbezogener Daten
          </h2>

          <p>
            Beim Besuch dieser Website können automatisch Informationen erfasst
            werden (z. B. Browser, Betriebssystem, Uhrzeit). Diese Daten dienen
            ausschließlich der technischen Bereitstellung der Website.
          </p>

          <h2 className="text-lg font-semibold text-white">
            Benutzerkonten & Einreichungen
          </h2>

          <p>
            Wenn du ein Benutzerkonto erstellst oder Daten (z. B. Wanderungen)
            einreichst, werden die von dir angegebenen Informationen gespeichert,
            um die Funktionen der Plattform bereitzustellen.
          </p>

          <h2 className="text-lg font-semibold text-white">
            Nutzung von Supabase
          </h2>

          <p>
            Diese Website nutzt Supabase als Backend-Dienst. Supabase verarbeitet
            Daten wie Benutzerkonten, Login-Informationen und eingereichte Inhalte.
            Die Verarbeitung erfolgt auf Servern innerhalb der EU.
          </p>

          <h2 className="text-lg font-semibold text-white">
            Deine Rechte
          </h2>

          <p>
            Du hast jederzeit das Recht auf Auskunft, Berichtigung oder Löschung
            deiner gespeicherten Daten sowie Einschränkung der Verarbeitung.
          </p>

          <h2 className="text-lg font-semibold text-white">
            Kontakt
          </h2>

          <p>
            Bei Fragen zum Datenschutz kannst du dich jederzeit an uns wenden:
            ultimatehikingleague@gmail.com
          </p>
        </div>
      </div>
    </main>
  )
}