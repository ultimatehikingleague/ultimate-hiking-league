import { isLocale } from './locales'

import paths from './public-paths.json'

const publicPaths = new Set(paths)

export function isPublicLanguagePath(path: string) {
  return publicPaths.has(path) || /^\/(events|challenges|organizers)\/[^/]+$/.test(path) || /^\/[1-9]\d*$/.test(path)
}

export function splitLanguagePath(path: string) {
  const slash = path.indexOf('/', 1)
  const locale = path.slice(1, slash === -1 ? undefined : slash)
  const pathname = slash === -1 ? '/' : path.slice(slash)
  return isLocale(locale) && isPublicLanguagePath(pathname) ? { locale, pathname } : null
}
