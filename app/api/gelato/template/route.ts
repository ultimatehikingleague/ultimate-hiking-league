import { NextResponse } from 'next/server'
import { requireShopAdmin } from '../../../lib/requireShopAdmin'

export async function GET(request: Request) {
  const isAdmin = await requireShopAdmin(request)

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Zugriff verweigert.' },
      { status: 403 }
    )
  }

  const apiKey = process.env.GELATO_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Gelato-Konfiguration fehlt.' },
      { status: 500 }
    )
  }

  const templateId = 'd1e0ea02-1992-4dc6-ad0e-3b8f8bcdb3ab'

  try {
    const response = await fetch(
      `https://ecommerce.gelatoapis.com/v1/templates/${templateId}`,
      {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      return NextResponse.json(
        {
          error: 'Gelato-Vorlagenabfrage fehlgeschlagen.',
          status: response.status,
        },
        { status: 502 }
      )
    }

    const template = await response.json()

    return NextResponse.json(template)
  } catch {
    return NextResponse.json(
      { error: 'Gelato konnte nicht erreicht werden.' },
      { status: 502 }
    )
  }
}