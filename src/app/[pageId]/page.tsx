import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import { connection } from 'next/server'
import { notFound, unstable_rethrow } from 'next/navigation'

import { NotionPageView } from '@/components/NotionPageView'
import { appConfig } from '@/lib/config'
import { getSiteMap } from '@/lib/get-site-map'
import { buildPageMetadata } from '@/lib/metadata-builder'
import { resolvePageModel } from '@/lib/page-model'
import { resolveNotionPage } from '@/lib/resolve-notion-page'
import { getPage } from '@/lib/notion'
import { getNavigationLinkPages } from '@/lib/notion-navigation'

export const revalidate = 3600
// Give cold/uncached Notion pages enough headroom to complete their retry budget
// (see notionMaxRetryBudget in lib/config.ts) instead of being killed mid-request.
export const maxDuration = 45

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
    unstable_rethrow(err)
    console.warn('[Metadata] Failed to resolve article metadata', err)
    return {}
  }
}

export async function generateStaticParams() {
  try {
    const siteMap = await getSiteMap('build-warmup')
    const slugs = Object.keys(siteMap.canonicalPageMap)
    const rawPageIds = Object.values(siteMap.canonicalPageMap)

    // Warm up the navigation link pages fully so they are cached locally on disk
    console.log(`[Notion Warmup] Warming up navigation pages...`)
    await getNavigationLinkPages('build-warmup')

    // Warm up the disk cache for all canonical pages from Redis/Notion in chunks using raw page UUIDs
    const concurrency = 3
    const chunks: string[][] = []
    for (let i = 0; i < rawPageIds.length; i += concurrency) {
      chunks.push(rawPageIds.slice(i, i + concurrency))
    }

    console.log(
      `[Notion Warmup] Starting disk cache warming for ${rawPageIds.length} pages...`
    )
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      console.log(
        `[Notion Warmup] Processing chunk ${i + 1}/${chunks.length} (${
          chunk.length
        } pages)...`
      )
      await Promise.all(
        chunk.map(async (pageId) => {
          try {
            await getPage(pageId, 'build-warmup')
          } catch (err) {
            unstable_rethrow(err)
            console.warn('[Notion Warmup] Failed to warm page', {
              pageId,
              error: err
            })
          }
        })
      )
    }
    console.log(`[Notion Warmup] Disk cache warming complete!`)

    return slugs.map((slug) => ({
      pageId: slug
    }))
  } catch (error) {
    unstable_rethrow(error)
    console.warn('failed to generate static params', error)
    return []
  }
}

export default async function NotionDomainDynamicPage({
  params
}: {
  params: Promise<{ pageId: string }>
}) {
  const { pageId } = await params
  try {
    const resolvedPage = await resolveNotionPage(pageId)
    if (resolvedPage.error?.statusCode === 404 || !resolvedPage.recordMap)
      notFound()
    return <NotionPageView {...resolvedPage} />
  } catch (err) {
    unstable_rethrow(err)
    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
      console.warn(
        `[Build] Failed to resolve Notion page "${pageId}". Deferring rendering to request time.`,
        err
      )
      await connection()
    }
    throw err
  }
}
