const frenchAndDutch = ['fr', 'nl'] as const
export const polishEnabled = process.env.NEXT_PUBLIC_UHL_PL === '1'
export const italianEnabled = process.env.NEXT_PUBLIC_UHL_IT === '1'
export const spanishEnabled = process.env.NEXT_PUBLIC_UHL_ES === '1'
export const czechEnabled = process.env.NEXT_PUBLIC_UHL_CS === '1'
export type Wave1Locale = (typeof frenchAndDutch)[number] | 'pl' | 'it' | 'es' | 'cs'
export const wave1Languages: readonly Wave1Locale[] = [
  ...frenchAndDutch,
  ...(polishEnabled ? ['pl'] as const : []),
  ...(italianEnabled ? ['it'] as const : []),
  ...(spanishEnabled ? ['es'] as const : []),
  ...(czechEnabled ? ['cs'] as const : []),
]
export const wave1Enabled = process.env.NEXT_PUBLIC_UHL_WAVE1 === '1'
export const wave1ReleaseBuild = wave1Enabled && process.env.VERCEL_ENV !== 'preview' &&
  process.env.UHL_WAVE1_RELEASE_BUILD === '1'

export function isWave1Locale(locale: unknown): locale is Wave1Locale {
  return wave1Languages.some(code => code === locale)
}
