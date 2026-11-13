import sharp from 'sharp'
import { shopAdminId } from '../../../../../lib/requireShopAdmin'
import { merchandiseSku } from '../../../../../lib/shop/merchandise'
import { orderDB } from '../../../../../lib/shop/orders'
import {
  managedImagePath, maxProductImageBytes, maxProductImages, productImageBucket, productImageTypes,
} from '../../../../../lib/shop/product-images'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' }
const reply = (data: unknown, status = 200) => Response.json(data, { headers, status })
const fail = (error: string, status: number) => reply({ error }, status)

export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin || !await shopAdminId(request)) {
      return fail('Zugriff verweigert.', 403)
    }
    const contentLength = Number(request.headers.get('content-length'))
    if (contentLength > maxProductImageBytes + 16 * 1024) return fail('Das Bild darf höchstens 4 MB groß sein.', 413)

    if (request.headers.get('content-type')?.startsWith('application/json')) {
      const body = await request.json().catch(() => null)
      if (!Array.isArray(body?.urls) || body.urls.length > maxProductImages) return fail('Ungültige Bildliste.', 400)
      const paths = body.urls.map((url: unknown) => typeof url === 'string' && managedImagePath(url))
      if (paths.some((path: unknown) => !path)) return fail('Ungültige Bildadresse.', 400)
      if (!paths.length) return reply({ previews: {} })
      const storage = orderDB().storage.from(productImageBucket)
      const { data, error } = await storage.createSignedUrls(paths, 3600)
      if (error) return fail('Bildvorschau vorübergehend nicht verfügbar.', 503)
      return reply({ previews: Object.fromEntries(data.map((row, index) => [body.urls[index], row.signedUrl])) })
    }

    const form = await request.formData().catch(() => null)
    const file = form?.get('image')
    const sku = form?.get('sku')
    if (typeof sku !== 'string' || !merchandiseSku.test(sku) || !(file instanceof File) || !file.size) {
      return fail('Wähle eine Bilddatei und gib eine gültige Produkt-SKU ein.', 400)
    }
    if (file.size > maxProductImageBytes) return fail('Das Bild darf höchstens 4 MB groß sein.', 413)
    if (file.type && !productImageTypes.includes(file.type)) return fail('Bitte JPG, PNG oder WebP verwenden.', 415)

    let optimized: Buffer
    try {
      const source = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 24_000_000 })
      const info = await source.metadata()
      if (!info.format || !['jpeg', 'png', 'webp'].includes(info.format) || (info.pages ?? 1) > 1) {
        return fail('Bitte ein einzelnes JPG-, PNG- oder WebP-Bild verwenden.', 415)
      }
      optimized = await source.rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 86 }).toBuffer()
    } catch {
      return fail('Das Bild ist beschädigt oder überschreitet 24 Megapixel.', 422)
    }

    const path = sku + '/' + crypto.randomUUID() + '.webp'
    const storage = orderDB().storage.from(productImageBucket)
    const { error } = await storage.upload(path, optimized, {
      contentType: 'image/webp', cacheControl: '3600', upsert: false,
    })
    if (error) return fail('Das Bild konnte nicht gespeichert werden. Bitte erneut versuchen.', 503)
    const url = new URL('/storage/v1/object/' + productImageBucket + '/' + path, process.env.NEXT_PUBLIC_SUPABASE_URL).href
    return reply({ url }, 201)
  } catch {
    return fail('Bildverwaltung vorübergehend nicht verfügbar.', 503)
  }
}
