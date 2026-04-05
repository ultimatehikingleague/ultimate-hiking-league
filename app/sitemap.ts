import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.ultimatehikingleague.com'

  return [
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