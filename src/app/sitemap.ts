import { getSiteMap } from '@/lib/get-site-map'
import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteMap = await getSiteMap()

  return Object.keys(siteMap.canonicalPageMap).map((canonicalPagePath) => ({
    url: `https://${process.env.DOMAIN}/${canonicalPagePath}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 1
  }))
}
