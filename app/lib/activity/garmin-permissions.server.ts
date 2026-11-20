export type GarminCommonFeed = 'deregistrations' | 'userPermissionsChange'

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function identifier(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 256 && Boolean(value.trim())
}

// Garmin OAuth2 PKCE 2.0, sections 7 and 9. Validate the entire delivery
// before sending any items to the database.
export function normalizeGarminCommonPush(feed: GarminCommonFeed, payload: unknown) {
  const envelope = object(payload)
  const items = envelope?.[feed]
  if (!envelope || Object.keys(envelope).length !== 1 || !Array.isArray(items)) {
    throw new Error('Invalid Garmin COMMON envelope')
  }

  const now = Math.floor(Date.now() / 1000)
  return items.map((value: unknown) => {
    const item = object(value)
    if (!item || !identifier(item.userId)) throw new Error('Invalid Garmin COMMON user')
    if (feed === 'deregistrations') return { user_id: item.userId }

    const { summaryId, permissions, changeTimeInSeconds } = item
    if (!identifier(summaryId) ||
        !Array.isArray(permissions) || !permissions.every(permission => typeof permission === 'string' &&
          /^[A-Z][A-Z0-9_]*$/.test(permission)) ||
        typeof changeTimeInSeconds !== 'number' || !Number.isSafeInteger(changeTimeInSeconds) ||
        changeTimeInSeconds <= 0 || changeTimeInSeconds > now) {
      throw new Error('Invalid Garmin permission change')
    }

    return {
      user_id: item.userId,
      change_time_seconds: changeTimeInSeconds,
      has_activity_export: permissions.includes('ACTIVITY_EXPORT'),
    }
  })
}
