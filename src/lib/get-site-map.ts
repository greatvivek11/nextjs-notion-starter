import { getAllPagesInSpace, getPageProperty } from 'notion-utils'
import { appConfig } from './config'
import { getCanonicalPageId } from './get-canonical-page-id'
import { getPage as getPageRobust } from './notion'
import { notionCache } from './notion-cache'
import * as types from './types'

const uuid = !!appConfig.includeNotionIdInUrls
const pendingSitemaps = new Map<string, Promise<Partial<types.SiteMap>>>()

export async function getSiteMap(source?: string): Promise<types.SiteMap> {
  const partialSiteMap = await getAllPages(
    appConfig.rootNotionPageId,
    appConfig.rootNotionSpaceId,
    source
  )

  return {
    site: appConfig.site,
    ...partialSiteMap
  } as types.SiteMap
}

const getAllPages = async (
  rootNotionPageId: string,
  rootNotionSpaceId: string,
  source?: string
): Promise<Partial<types.SiteMap>> => {
  const cacheKey = JSON.stringify({ rootNotionPageId, rootNotionSpaceId })

  // 1. Check modular cache (Memory + Disk)
  const cached = await notionCache.getSitemap(cacheKey, source)
  if (cached) {
    console.log(`[Notion Sitemap] Cache HIT (Modular)`)
    return cached
  }

  console.log(
    `[Notion Sitemap] Cache MISS. Fetching full space map from API...`
  )
  const pending = pendingSitemaps.get(cacheKey)
  if (pending) return structuredClone(await pending)
  const fetchPromise = (async () => {
    try {
      const result = await getAllPagesImpl(
        rootNotionPageId,
        rootNotionSpaceId,
        source
      )
      await notionCache.setSitemap(cacheKey, result, source)
      return result
    } finally {
      pendingSitemaps.delete(cacheKey)
    }
  })()
  pendingSitemaps.set(cacheKey, fetchPromise)
  return structuredClone(await fetchPromise)
}

async function getAllPagesImpl(
  rootNotionPageId: string,
  rootNotionSpaceId: string,
  source?: string
): Promise<Partial<types.SiteMap>> {
  const getPage = async (pageId: string) => {
    return getPageRobust(pageId, source || 'SiteMap')
  }

  const pageMap = await getAllPagesInSpace(
    rootNotionPageId,
    rootNotionSpaceId,
    getPage
  )

  const canonicalPageMap = Object.keys(pageMap).reduce(
    (map, pageId: string) => {
      const recordMap = pageMap[pageId]
      if (!recordMap) {
        throw new Error(`Error loading page "${pageId}"`)
      }

      const blockEntry = recordMap.block[pageId]
      const block =
        (blockEntry as any)?.value?.value ||
        (blockEntry as any)?.value ||
        blockEntry
      if (
        !(getPageProperty<boolean | null>('Public', block, recordMap) ?? true)
      ) {
        return map
      }

      const canonicalPageId = getCanonicalPageId(pageId, recordMap, {
        uuid
      })

      if (map[canonicalPageId]) {
        // you can have multiple pages in different collections that have the same id
        // TODO: we may want to error if neither entry is a collection page
        // console.warn('error duplicate canonical page id', {
        //   canonicalPageId,
        //   pageId,
        //   existingPageId: map[canonicalPageId]
        // })

        return map
      } else {
        return {
          ...map,
          [canonicalPageId]: pageId
        }
      }
    },
    {}
  )

  return {
    pageMap,
    canonicalPageMap
  }
}
