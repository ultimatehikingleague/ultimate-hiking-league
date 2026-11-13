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

  const storeId = 'd9058989-bd70-4cf4-a4ad-63a6687400ef'
  const productId = '9a21d4bb-ebd9-4c3a-bda0-1cc314843e9f'

  try {
    const response = await fetch(
      `https://ecommerce.gelatoapis.com/v1/stores/${storeId}/products/${productId}`,
      {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      const details = await response.text()

      return NextResponse.json(
        {
          error: 'Gelato-Produktabfrage fehlgeschlagen.',
          status: response.status,
          details,
        },
        { status: 502 }
      )
    }

    const product = await response.json()

    return NextResponse.json(product)
  } catch {
    return NextResponse.json(
      { error: 'Gelato konnte nicht erreicht werden.' },
      { status: 502 }
    )
  }
}