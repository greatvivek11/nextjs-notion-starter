import { NotionPage } from '@/components/NotionPage'
import { appConfig } from '@/lib/config'
import { buildPageMetadata } from '@/lib/metadata-builder'
import { resolvePageModel } from '@/lib/page-model'
import { getAllTags, resolveTagPage } from '@/lib/tag-service'
import { normalizeTitle } from 'notion-utils'

export const revalidate = 60

export async function generateMetadata({
  params
}: {
  params: Promise<{ tagName: string }>
}) {
  try {
    const { tagName } = await params
    const resolvedPage = await resolveTagPage(tagName)
    const pageModel = resolvePageModel(resolvedPage)
    return buildPageMetadata(pageModel, appConfig)
  } catch (err) {
    return {}
  }
}

export async function generateStaticParams() {
  // We return an empty array to make all tag pages ISR (Incremental Static Regeneration).
  // This prevents hitting Notion API rate limits for every tag during the build phase.
  return []
}

export default async function NotionTagsPage({
  params
}: {
  params: Promise<{ tagName: string }>
}) {
  const { tagName } = await params
  const resolvedPage = await resolveTagPage(tagName)
  return <NotionPage {...resolvedPage} />
}
