import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/private/', '/api/get-tweet-ast/*', '/api/search-notion']
    },
    sitemap: `https://${process.env.DOMAIN}/sitemap.xml`
  }
}
