import { ExtendedRecordMap } from 'notion-types'
import { navigationLinks, navigationStyle } from './config'
import { notion } from './notion-api'
import { notionCache } from './notion-cache'
import { withRetry } from './notion-retry'

/**
 * Fetches thin record maps for navigation link pages (used in custom nav styles).
 * Results are cached to avoid redundant fetches on every page load.
 */
export async function getNavigationLinkPages(source = 'unknown'): Promise<ExtendedRecordMap[]> {
  const navigationLinkPageIds = (navigationLinks || [])
    .map((link) => link?.pageId)
    .filter(Boolean)

  if (navigationStyle === 'default' || !navigationLinkPageIds.length) return []

  return Promise.all(
    navigationLinkPageIds.map(async (pageId) => {
      const cached = await notionCache.getNavLinkPage(pageId, source)
      if (cached) return cached

      const recordMap = await withRetry(() =>
        notion.getPage(pageId, {
          signFileUrls: true,
          fetchCollections: false,
          fetchMissingBlocks: false,
          concurrency: 1
        })
      )

      await notionCache.setNavLinkPage(pageId, recordMap, source)
      return recordMap
    })
  )
}
