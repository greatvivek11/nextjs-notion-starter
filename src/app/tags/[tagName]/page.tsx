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
  try {
    const tags = await getAllTags()
    return tags.map((tagName) => ({
      tagName: normalizeTitle(tagName)
    }))
  } catch (error) {
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
  return <NotionPage {...resolvedPage} />
}
