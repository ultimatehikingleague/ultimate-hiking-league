import { supabase } from '../../../lib/supabase'

export function merchandiseRequest(query = '', body?: object) {
  return shopAdminRequest('/api/admin/shop/products' + query, body)
}

export async function shopAdminRequest(endpoint: string, body?: object) {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Bitte als Administrator anmelden.')
  const response = await fetch(endpoint, {
    method: body ? 'POST' : 'GET',
    cache: 'no-store',
    headers: { Authorization: 'Bearer ' + data.session.access_token, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Aktion fehlgeschlagen.')
  return result
}
