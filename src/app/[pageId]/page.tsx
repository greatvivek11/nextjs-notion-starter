import { NotionPage } from '@/components/NotionPage'
import { domain } from '@/lib/config'
import { getSiteMap } from '@/lib/get-site-map'
import { resolveNotionPage } from '@/lib/resolve-notion-page'
import type { PageProps } from '@/lib/types'

// This is needed to generate pages at runtime dynamically using ISR.
export const runtime = 'nodejs'

async function getPageProps(pageId: string): Promise<PageProps> {
  try {
    return await resolveNotionPage(pageId)
  } catch (err) {
    console.error('page error', domain, pageId, err)
    throw err
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
}: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params
  const props = await getPageProps(pageId)
  return <NotionPage {...props} />
}
