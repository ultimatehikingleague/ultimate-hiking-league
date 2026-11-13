export function isLocalActivityImport(url: string | undefined) {
  if (!url || process.env.NODE_ENV !== 'development' ||
    process.env.NEXT_PUBLIC_ACTIVITY_IMPORT_ENABLED !== 'true') return false
  try {
    const address = new URL(url)
    return ['http:', 'https:'].includes(address.protocol) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(address.hostname)
  } catch {
    return false
  }
}
