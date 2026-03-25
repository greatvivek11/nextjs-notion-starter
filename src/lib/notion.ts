'use server'
import { ExtendedRecordMap, SearchParams, SearchResults } from 'notion-types'
import { mergeRecordMaps, parsePageId } from 'notion-utils'
import {
  navigationLinks,
  navigationStyle,
  notionRetryDelay
} from './config'
import { notion } from './notion-api'
import { notionCache } from './notion-cache'
import { notionRateLimiter } from './notion-rate-limiter'

/**
 * Robust wrapper for Notion API calls with automated retries, 
 * concurrency limiting, and Retry-After header support.
 */
const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = 8,
  delay = 1000
): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await notionRateLimiter.execute(fn)
    } catch (err: any) {
      if (i === retries - 1) throw err

      const is429 =
        err.message?.includes('429') ||
        err.status === 429 ||
        err.statusCode === 429
      
      let currentDelay = delay
      if (is429) {
        // Respect Retry-After header, or fallback to config delay
        const retryAfter = err.response?.headers?.get('Retry-After') || err.headers?.['retry-after']
        const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : 0
        
        if (retryAfterSeconds > 0) {
          currentDelay = retryAfterSeconds * 1000
          console.warn(`[Notion API] Respecting Retry-After: ${retryAfterSeconds}s`)
        } else {
          currentDelay = notionRetryDelay
          console.warn(`[Notion API] 429 detected. Delaying ${currentDelay}ms.`)
        }
      }

      await new Promise((resolve) => setTimeout(resolve, currentDelay))
      delay *= 2
    }
  }
  throw new Error('Retry limit reached')
}

/**
 * Fetches all pages linked in the site's navigation header.
 */
const getNavigationLinkPages = async (): Promise<ExtendedRecordMap[]> => {
  const navigationLinkPageIds = (navigationLinks || [])
    .map((link) => link?.pageId)
    .filter(Boolean)

  if (navigationStyle !== 'default' && navigationLinkPageIds.length) {
    return Promise.all(
      navigationLinkPageIds.map(async (navigationLinkPageId) => {
        // Check modular cache
        const cached = await notionCache.getNavLinkPage(navigationLinkPageId)
        if (cached) return cached

        // Fetch "thin" version for nav metadata
        const recordMap = await withRetry(() =>
          notion.getPage(navigationLinkPageId, {
            chunkLimit: 1,
            fetchMissingBlocks: false,
            fetchCollections: false,
            signFileUrls: true,
            concurrency: 1
          })
        )

        await notionCache.setNavLinkPage(navigationLinkPageId, recordMap)
        return recordMap
      })
    )
  }

  return []
}

/**
 * Main entry point for fetching a Notion page. 
 * Includes caching, gallery recovery, and navigation merging.
 */
export async function getPage(
  pageId: string,
  source = 'unknown'
): Promise<ExtendedRecordMap> {
  // 1. Modular Cache Check
  const cached = await notionCache.getPage(pageId)
  if (cached) {
    const collectionsCount = Object.keys(cached.collection || {}).length
    const viewsCount = Object.keys(cached.collection_view || {}).length
    
    // Recovery Logic: If page has collections but no views, it's likely "thin" cached
    if (collectionsCount > 0 && viewsCount === 0) {
      console.log(`[Notion Cache] Page: ${pageId} has collections but 0 views. FORCING RE-FETCH.`)
    } else {
      console.log(`[Notion FS HIT] Page: ${pageId}. Collections: ${collectionsCount}, Views: ${viewsCount}`)
      return cached
    }
  }

  // 2. Fresh API Fetch
  console.log(`[Notion] Cache MISS for page: ${pageId} (source: ${source}). Fetching...`)
  let recordMap = await withRetry(() =>
    notion.getPage(pageId, {
      signFileUrls: false,
      fetchCollections: true,
      fetchMissingBlocks: true,
      concurrency: 1
    })
  )

  const collectionsCount = Object.keys(recordMap.collection || {}).length
  const viewsCount = Object.keys(recordMap.collection_view || {}).length
  console.log(`[Notion Fetch] Page: ${pageId}. Collections: ${collectionsCount}, Views: ${viewsCount}`)

  // 3. Save to Caches
  await notionCache.setPage(pageId, recordMap)

  // 4. Navigation Merging
  if (navigationStyle !== 'default') {
    const navigationLinkRecordMaps = await getNavigationLinkPages()

    if (navigationLinkRecordMaps?.length) {
      recordMap = navigationLinkRecordMaps.reduce(
        (map, navigationLinkRecordMap) => {
          // Guard: Avoid merging the page into itself (prevents stripping collections)
          const navPageId = Object.keys(navigationLinkRecordMap.block || {})[0]
          if (navPageId === pageId) return map

          return mergeRecordMaps(map, navigationLinkRecordMap)
        },
        recordMap
      )
    }
  }

  return recordMap
}

export async function search(params: SearchParams): Promise<SearchResults> {
  return notion.search({
    query: params.query,
    ancestorId: parsePageId(params.ancestorId),
    type: 'BlocksInAncestor',
    filters: {
      isDeletedOnly: false,
      isNavigableOnly: false,
      excludeTemplates: false,
      requireEditPermissions: false
    },
    ...params
  } as any)
}
