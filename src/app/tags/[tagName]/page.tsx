import { NotionPageView } from '@/components/NotionPageView'
import { appConfig } from '@/lib/config'
import { buildPageMetadata } from '@/lib/metadata-builder'
import { resolvePageModel } from '@/lib/page-model'
import { getAllTags, resolveTagPage } from '@/lib/tag-service'
import { normalizeTitle } from 'notion-utils'
import { notFound, unstable_rethrow } from 'next/navigation'

export const revalidate = 3600

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
    unstable_rethrow(err)
    console.warn('[Metadata] Failed to resolve tag metadata', err)
    return {}
  }
}

export async function generateStaticParams() {
  try {
    const tags = await getAllTags()
    return tags.map((tagName) => ({
      tagName: normalizeTitle(tagName)
    }))
  } catch (error) {
    unstable_rethrow(error)
    console.warn('failed to generate static tag params', error)
    return []
  }
}

export default async function NotionTagsPage({
  params
}: {
  params: Promise<{ tagName: string }>
}) {
  const { tagName } = await params
  const resolvedPage = await resolveTagPage(tagName)
  if (
    resolvedPage.error?.statusCode === 404 ||
    !resolvedPage.recordMap ||
    !resolvedPage.propertyToFilterName
  )
    notFound()
  return <NotionPageView {...resolvedPage} />
}
