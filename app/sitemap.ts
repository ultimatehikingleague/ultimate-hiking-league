import { MetadataRoute } from 'next'
import { locales } from '@/i18n/locales'
import { wave1ReleaseBuild } from '@/i18n/wave1'
import { publishedLanguages } from '@/i18n/language-register'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.ultimatehikingleague.com'

  return [
    ...((wave1ReleaseBuild ? locales : publishedLanguages).flatMap(locale => ['event-reviews', 'organizer-reviews'].map(path => ({
      url: `${baseUrl}/${locale}/leaderboard/${path}`,
    })))),
    {
      url: baseUrl,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/overall`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/rules`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/impressum`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/datenschutz`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/kontakt`,
      lastModified: new Date(),
    },
  ]
}