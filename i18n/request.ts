import { cookies, headers } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { isLocale, languageCookie, resolveLocale } from './locales'
import { authLanguageCookie } from './auth-language'

import { catalogs } from './catalogs'

export default getRequestConfig(async ({ locale: explicitLocale, requestLocale }) => {
  const routeLocale = explicitLocale ?? await requestLocale
  if (isLocale(routeLocale)) return { locale: routeLocale, messages: await catalogs[routeLocale]() }
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()])
  const manual = cookieStore.get(languageCookie)?.value
  const context = cookieStore.get(authLanguageCookie)?.value
  const locale = resolveLocale(isLocale(manual) ? manual : context, requestHeaders.get('accept-language'))
  return { locale, messages: await catalogs[locale]() }
})
