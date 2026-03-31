import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'RESEND_API_KEY fehlt' },
      { status: 500 }
    )
  }

const resend = new Resend(apiKey)
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
        <div style="background-color:#141312; padding:40px 20px; font-family: Arial, sans-serif;">
          <div style="max-width:520px; margin:0 auto; background:#1c1b1a; border-radius:16px; padding:32px; color:#ffffff;">

            <div style="text-align:center; margin-bottom:24px;">
              <h2 style="margin:0; font-size:22px; font-weight:700;">
                Ultimate Hiking League
              </h2>
            </div>

            <h1 style="font-size:20px; margin-bottom:16px;">
              Willkommen in der Liga
            </h1>

            <p style="color:#cfcfcf; font-size:14px;">
              Dein Zugang ist aktiv. Ab jetzt kannst du deine Märsche erfassen,
              deine Entwicklung verfolgen und dich im Ranking einordnen.
            </p>

            <div style="margin:24px 0; padding:16px; background:#141312; border-radius:12px;">
              <ul style="padding-left:18px; margin:0; color:#e5e5e5; font-size:14px; line-height:1.6;">
                <li>Alle deine Wanderungen an einem Ort</li>
                <li>Übersicht deiner persönlichen Leistungskurve</li>
                <li>Zugriff auf Events inkl. Buchungsmöglichkeiten</li>
                <li>Vergleich mit anderen Teilnehmern im Ranking</li>
              </ul>
            </div>

            <div style="text-align:center; margin:28px 0;">
              <a href="https://ultimate-hiking-league.vercel.app/account"
                style="display:inline-block; background:#ffffff; color:#000000; padding:12px 20px; border-radius:12px; font-size:14px; font-weight:600; text-decoration:none;">
                Profil öffnen
              </a>
            </div>

            <p style="color:#9e9e9e; font-size:12px; text-align:center; margin-top:24px;">
              Baue dir Schritt für Schritt dein Profil in der Liga auf.
            </p>

          </div>
        </div>
      `
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