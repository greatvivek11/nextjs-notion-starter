import { NotionPage } from '@/components/NotionPage'
import { appConfig } from '@/lib/config'
import { getSiteMap } from '@/lib/get-site-map'
import { buildPageMetadata } from '@/lib/metadata-builder'
import { resolvePageModel } from '@/lib/page-model'
import { resolveNotionPage } from '@/lib/resolve-notion-page'

export const revalidate = 60

export async function generateMetadata({
  params
}: {
  params: Promise<{ pageId: string }>
}) {
  try {
    const { pageId } = await params
    const resolvedPage = await resolveNotionPage(pageId)
    const pageModel = resolvePageModel(resolvedPage)
    return buildPageMetadata(pageModel, appConfig)
  } catch (err) {
    return {}
  }
}

export async function generateStaticParams() {
  const siteMap = await getSiteMap()
  return Object.keys(siteMap.canonicalPageMap).map((pageId) => ({
    pageId
  }))
}

export default async function NotionDomainDynamicPage({
  params
}: {
  params: Promise<{ pageId: string }>
}) {
  const { pageId } = await params
  const resolvedPage = await resolveNotionPage(pageId)
  return <NotionPage {...resolvedPage} />
}
