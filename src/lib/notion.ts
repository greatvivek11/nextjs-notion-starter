'use server'
import { ExtendedRecordMap, SearchParams, SearchResults } from 'notion-types'
import { mergeRecordMaps, parsePageId } from 'notion-utils'
import { notion } from './notion-api'
import { notionCache } from './notion-cache'
import { withRetry } from './notion-retry'
import { applyFormatPropertyFilters } from './notion-filters'
import { fetchLinkedCollections } from './notion-collections'
import { getNavigationLinkPages } from './notion-navigation'
import { navigationStyle } from './config'

// ---------------------------------------------------------------------------
// Request Deduplication
// Prevents redundant parallel API calls for the same page (cache-stampede guard).
// ---------------------------------------------------------------------------
const pendingPages = new Map<string, Promise<ExtendedRecordMap>>()

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Main entry point for fetching a Notion page.
 *
 * Flow:
 * 1. FS cache hit → apply filters → return
 * 2. In-flight deduplication → join pending promise
 * 3. Fresh fetch → linked collection enrichment → cache → nav merge → filters → return
 */
export async function getPage(pageId: string, source = 'unknown'): Promise<ExtendedRecordMap> {
  // Cache check
  let recordMap = await notionCache.getPage(pageId)

  if (recordMap) {
    const collections = Object.keys(recordMap.collection || {}).length
    const views = Object.keys(recordMap.collection_view || {}).length

    if (collections > 0 && views === 0) {
      // Thin cache (missing view data) — force re-fetch
      console.log(`[Notion Cache] Page: ${pageId} has collections but 0 views. Re-fetching.`)
      recordMap = null as any
    } else {
      console.log(`[Notion FS HIT] Page: ${pageId}. Collections: ${collections}, Views: ${views}`)
      applyFormatPropertyFilters(recordMap)
      return recordMap
    }
  }

  // Deduplication: join an in-flight request if one exists
  const pending = pendingPages.get(pageId)
  if (pending) {
    console.log(`[Notion] Joining pending request for page: ${pageId}`)
    return pending
  }

  const fetchPromise = (async () => {
    try {
      console.log(`[Notion] Cache MISS for page: ${pageId} (source: ${source}). Fetching...`)
      recordMap = await withRetry(() =>
        notion.getPage(pageId, {
          signFileUrls: false,
          fetchCollections: true,
          fetchMissingBlocks: true,
          concurrency: 1
        })
      )

      const collections = Object.keys(recordMap.collection || {}).length
      const views = Object.keys(recordMap.collection_view || {}).length
      console.log(`[Notion Fetch] Page: ${pageId}. Collections: ${collections}, Views: ${views}`)

      // Enrich with linked collection data (scoped to views embedded on this page)
      recordMap = await fetchLinkedCollections(recordMap, pageId)

      // Persist to cache (unfiltered — filters are dynamic and applied per-request)
      await notionCache.setPage(pageId, recordMap)

      // Merge navigation link pages (custom nav style only)
      if (navigationStyle !== 'default') {
        const navMaps = await getNavigationLinkPages()
        if (navMaps?.length) {
          recordMap = navMaps.reduce((map, navMap) => {
            const navPageId = Object.keys(navMap.block || {})[0]
            if (!navPageId) return map
            return navPageId === pageId ? map : mergeRecordMaps(map, navMap)
          }, recordMap)
        }
      }

      // Apply view filters (always last — filters depend on current date for relative ranges)
      applyFormatPropertyFilters(recordMap)

      return recordMap
    } finally {
      pendingPages.delete(pageId)
    }
  })()

  pendingPages.set(pageId, fetchPromise)
  return fetchPromise
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
