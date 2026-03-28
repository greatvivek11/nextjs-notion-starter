import { ExtendedRecordMap } from 'notion-types'
import { navigationLinks, navigationStyle } from './config'
import { notion } from './notion-api'
import { notionCache } from './notion-cache'
import { withRetry } from './notion-retry'

/**
 * Fetches thin record maps for navigation link pages (used in custom nav styles).
 * Results are cached to avoid redundant fetches on every page load.
 */
export async function getNavigationLinkPages(): Promise<ExtendedRecordMap[]> {
  const navigationLinkPageIds = (navigationLinks || [])
    .map((link) => link?.pageId)
    .filter(Boolean)

  if (navigationStyle === 'default' || !navigationLinkPageIds.length) return []

  return Promise.all(
    navigationLinkPageIds.map(async (pageId) => {
      const cached = await notionCache.getNavLinkPage(pageId)
      if (cached) return cached

      const recordMap = await withRetry(() =>
        notion.getPage(pageId, {
          chunkLimit: 1,
          fetchMissingBlocks: false,
          fetchCollections: false,
          signFileUrls: true,
          concurrency: 1
        })
      )

      await notionCache.setNavLinkPage(pageId, recordMap)
      return recordMap
    })
  )
}
