import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, type } = body

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email fehlt' },
        { status: 400 }
      )
    }

    if (type !== 'welcome') {
      return NextResponse.json(
        { success: false, error: 'Ungültiger Mail-Typ' },
        { status: 400 }
      )
    }

    const { error } = await resend.emails.send({
      from: 'Ultimate Hiking League <onboarding@resend.dev>',
      to: email,
      subject: 'Willkommen bei der Ultimate European Hiking League',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
          <h2>Willkommen bei der Ultimate European Hiking League</h2>
          <p>Schön, dass du dabei bist.</p>
          <p>
            Dein Zugang wurde erfolgreich erstellt. Du kannst dich jetzt einloggen,
            Wanderungen einreichen und Schritt für Schritt dein Profil in der Liga aufbauen.
          </p>
          <p>
            Wir wünschen dir viel Freude und starke Märsche.
          </p>
          <p>
            — Ultimate Hiking League Team
          </p>
        </div>
      `,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json(
        { success: false, error: 'Mailversand fehlgeschlagen' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('send-submission-email error:', error)
    return NextResponse.json(
      { success: false, error: 'Email route failed' },
      { status: 500 }
    )
  }
}