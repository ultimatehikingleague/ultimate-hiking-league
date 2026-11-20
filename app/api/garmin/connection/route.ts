import {
  authenticateGarmin, decryptGarminValue, encryptGarminTokens, GarminInvalidGrant, garminResponse, refreshGarminTokens,
  type exchangeGarminCode,
} from '../../../lib/activity/garmin-connection.server'

export async function DELETE(request: Request) {
  try {
    const access = await authenticateGarmin(request)
    if (access instanceof Response) return access
    const { config, owner } = access
    const connections = config.db.from('garmin_connections')
    const now = new Date()
    const lease = new Date(now.getTime() + 90_000).toISOString()
    const { data, error } = await connections.update({ disconnect_lease_until: lease }).eq('user_id', owner)
      .or(`disconnect_lease_until.is.null,disconnect_lease_until.lt.${now.toISOString()}`)
      .select('encrypted_tokens, deregistered_at').maybeSingle()
    if (error) return garminResponse(503)
    if (!data) {
      const current = await connections.select('user_id').eq('user_id', owner).maybeSingle()
      return garminResponse(current.error ? 503 : current.data ? 409 : 204)
    }

    try {
      const active = await config.db.from('garmin_push_inbox').select('id')
        .eq('owner_id', owner).is('processed_at', null).gt('lease_until', now.toISOString()).limit(1)
      if (active.error || active.data.length) return garminResponse(active.error ? 503 : 409)

      if (!data.deregistered_at) {
        let tokens: Awaited<ReturnType<typeof exchangeGarminCode>> =
          JSON.parse(decryptGarminValue(config.tokenKey, owner, data.encrypted_tokens))
        const deregister = (token: string) => fetch('https://apis.garmin.com/wellness-api/rest/user/registration', {
          method: 'DELETE', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000),
          headers: { Authorization: `Bearer ${token}` },
        })

        try {
          let result = tokens.accessExpiresAt > Date.now() ? await deregister(tokens.accessToken) : null
          if (!result || result.status === 401) {
            tokens = await refreshGarminTokens(config, tokens.refreshToken)
            const saved = await connections.update({ encrypted_tokens: encryptGarminTokens(config.tokenKey, owner, tokens) })
              .eq('user_id', owner).eq('disconnect_lease_until', lease).select('user_id').maybeSingle()
            if (saved.error || !saved.data) return garminResponse(503)
            result = await deregister(tokens.accessToken)
          }
          if (!result.ok && result.status !== 404) return garminResponse(502)
        } catch (error) {
          if (!(error instanceof GarminInvalidGrant)) throw error
        }

        // Preserve the local block if Storage is temporarily unavailable.
        const blocked = await connections.update({ activity_export_revoked_at: now.toISOString(), deregistered_at: now.toISOString() })
          .eq('user_id', owner).eq('disconnect_lease_until', lease).select('user_id').maybeSingle()
        if (blocked.error || !blocked.data) return garminResponse(503)
      }
      const bucket = config.db.storage.from('garmin-activity-files')
      for (let batch = 0; batch < 4; batch++) {
        const { data: objects, error: listError } = await bucket.list(owner, { limit: 100 })
        if (listError) return garminResponse(503)
        if (!objects.length) {
          const deleted = await connections.delete().eq('user_id', owner).eq('disconnect_lease_until', lease)
          return garminResponse(deleted.error ? 503 : 204)
        }
        const { error: removeError } = await bucket.remove(objects.map(object => `${owner}/${object.name}`))
        if (removeError) return garminResponse(503)
      }
      return garminResponse(503)
    } finally {
      await connections.update({ disconnect_lease_until: null }).eq('user_id', owner).eq('disconnect_lease_until', lease)
    }
  } catch {
    return garminResponse(503)
  }
}
