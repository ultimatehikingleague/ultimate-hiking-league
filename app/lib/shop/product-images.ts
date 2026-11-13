export const productImageBucket = 'shop-product-images'
export const maxProductImages = 12
export const maxProductImageBytes = 4 * 1024 * 1024
export const productImageTypes = ['image/jpeg', 'image/png', 'image/webp']

export function managedImagePath(url: string, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL): string | null {
  if (!supabaseUrl) return null
  const prefix = new URL('/storage/v1/object/' + productImageBucket + '/', supabaseUrl).href
  if (!url.startsWith(prefix)) return null
  const path = url.slice(prefix.length)
  return /^[A-Z0-9][A-Z0-9_-]{1,63}\/[a-f0-9-]{36}\.webp$/.test(path) ? path : null
}

export function moveProductImage<T>(images: T[], from: number, to: number): T[] {
  if (from < 0 || to < 0 || from >= images.length || to >= images.length || from === to) return images
  const ordered = [...images]
  ordered.splice(to, 0, ordered.splice(from, 1)[0])
  return ordered
}
