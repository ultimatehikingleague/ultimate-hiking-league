export const screenshotBucket = 'activity-screenshot-proofs'
export const privateScreenshotPrefix = 'activity-screenshot:'

const pathPattern = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-3]\.(png|jpg|webp)$/

export function privateScreenshotPaths(reference: string, owner: string): string[] {
  if (!reference.startsWith(privateScreenshotPrefix)) return []
  const paths = reference.slice(privateScreenshotPrefix.length).split(',')
  if (paths.length > 4 || paths.some(path => !pathPattern.test(path) || !path.startsWith(owner + '/'))) return []
  return paths
}

export async function isScreenshotImage(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const has = (offset: number, signature: number[]) => signature.every((byte, i) => bytes[offset + i] === byte)
  switch (file.type) {
    case 'image/png': return has(0, [137, 80, 78, 71, 13, 10, 26, 10])
    case 'image/jpeg': return has(0, [255, 216, 255])
    case 'image/webp': return has(0, [82, 73, 70, 70]) && has(8, [87, 69, 66, 80])
    default: return false
  }
}
