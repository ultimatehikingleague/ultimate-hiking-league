import { requireShopAdmin } from '../../../../lib/requireShopAdmin'
import { getAdminMetrics } from '../../../../lib/shop/admin-metrics'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' }
export async function GET(request: Request) {
 try {
  if (!await requireShopAdmin(request)) return Response.json({ error: 'Zugriff verweigert.' }, { status: 403, headers })
  return Response.json(await getAdminMetrics(), { headers })
 } catch { return Response.json({ error: 'Kennzahlen konnten nicht geladen werden.' }, { status: 503, headers }) }
}
