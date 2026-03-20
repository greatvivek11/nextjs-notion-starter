import { AppConfig, PageModel } from '@/types'
import type { Metadata } from 'next'

/**
 * Transforms a PageModel and AppConfig into Next.js Metadata.
 *
 * This centralizes SEO and social media metadata generation.
 */
export function buildPageMetadata(
  page: PageModel,
  config: AppConfig
): Metadata {
  const { title, description, image, url } = page

  const siteName = config.name
  const fullTitle =
    page.id === config.rootNotionPageId ? siteName : `${title} | ${siteName}`

  return {
    title: fullTitle,
    description: description || config.description,
    openGraph: {
      title: fullTitle,
      description: description || config.description,
      url,
      siteName,
      images: image ? [{ url: image }] : [],
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: description || config.description,
      images: image ? [image] : [],
      creator: config.twitter || undefined
    },
    alternates: {
      canonical: url
    }
  }
}
