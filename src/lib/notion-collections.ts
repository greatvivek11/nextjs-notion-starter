import { ExtendedRecordMap } from 'notion-types'
import { mergeRecordMaps } from 'notion-utils'
import { notion } from './notion-api'
import { withRetry } from './notion-retry'
import { unwrap, extractBlockIdsFromCollectionQuery } from './notion-helpers'

/**
 * Module-level TTL cache for parent database fetches.
 * Prevents `fetchLinkedDatabasePages` from firing on every request when the
 * FS page cache is warm. Entries expire after PARENT_FETCH_TTL_MS.
 */
const recentParentFetches = new Map<string, number>()
const PARENT_FETCH_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Collects view IDs that are actually embedded in a page's content tree.
 * Notion's getPage API returns all views from the parent collection, but
 * only views referenced by collection_view blocks in the page's content
 * are relevant for rendering.
 *
 * Returns null if no pageId block is found (fallback to all views).
 */
function getEmbeddedViewIds(recordMap: ExtendedRecordMap, pageId: string): Set<string> | null {
  const rootBlock = unwrap(recordMap.block[pageId])
  if (!rootBlock?.content) return null

  const viewIds = new Set<string>()

  for (const blockId of rootBlock.content) {
    const block = unwrap(recordMap.block[blockId])
    if (!block) continue

    if (block.type === 'collection_view' || block.type === 'collection_view_page') {
      const ids: string[] = block.view_ids || []
      ids.forEach((vid: string) => viewIds.add(vid))
    }
  }

  return viewIds
}

/**
 * Fetches collection query data for linked views that don't have results yet.
 * Returns an array of merged record maps — one per fetched collection.
 */
async function fetchCollectionQueryData(
  tasksToFetch: { cid: string; vid: string }[],
  missingBlockIds: Set<string>
): Promise<ExtendedRecordMap[]> {
  const maps = await Promise.all(
    tasksToFetch.map(async ({ cid, vid }) => {
      try {
        const lrm = await withRetry(() => (notion as any).getCollectionData(cid, vid))
        if (lrm) {
          const bIds = (lrm as any)?.collection_query?.[cid]?.[vid]?.collection_group_results?.blockIds
          if (bIds) bIds.forEach((id: string) => missingBlockIds.add(id))
          return lrm as ExtendedRecordMap
        }
      } catch (err) {
        console.error(`[Notion] Failed to fetch linked collection ${cid}:`, err)
      }
      return null
    })
  )
  return maps.filter(Boolean) as ExtendedRecordMap[]
}

/**
 * Fetches the parent database page for each linked collection.
 *
 * Notion's linked view cache can be stale — newly added articles may not appear
 * in `getCollectionData` results. Fetching the backing database page directly
 * (using its own collection queries) always returns a fresh, complete article list.
 *
 * This is O(linkedDatabases) calls — typically 1–3 — not O(articles).
 */
async function fetchLinkedDatabasePages(
  linkedCollectionIds: Set<string>,
  mergedMap: ExtendedRecordMap,
  missingBlockIds: Set<string>
): Promise<ExtendedRecordMap> {
  const parentIds = new Set<string>()

  for (const cid of linkedCollectionIds) {
    const parentId = unwrap(mergedMap.collection[cid])?.parent_id
    if (parentId) parentIds.add(parentId)
  }

  if (parentIds.size === 0) return mergedMap

  console.log(`[Notion] Fetching ${parentIds.size} linked database page(s) for fresh article discovery...`)

  const dbPageMaps = await Promise.all(
    Array.from(parentIds).map(async (pid) => {
      try {
        return await withRetry(() =>
          notion.getPage(pid, {
            signFileUrls: false,
            fetchCollections: true,
            fetchMissingBlocks: false,
            concurrency: 1
          })
        )
      } catch (err) {
        console.error(`[Notion] Failed to fetch linked DB parent page ${pid}:`, err)
        return null
      }
    })
  )

  for (const dbMap of dbPageMaps) {
    if (!dbMap) continue
    mergedMap = mergeRecordMaps(mergedMap, dbMap)
    extractBlockIdsFromCollectionQuery(dbMap.collection_query)
      .forEach((id) => missingBlockIds.add(id))
  }

  return mergedMap
}

/**
 * Batch-fetches block content for any article IDs not yet in the record map.
 * Uses Notion's `getBlocks` endpoint (50 per request) to minimize API calls.
 */
async function recoverMissingBlocks(
  mergedMap: ExtendedRecordMap,
  missingBlockIds: Set<string>
): Promise<ExtendedRecordMap> {
  if (missingBlockIds.size === 0) return mergedMap

  console.log(`[Notion] Recovering ${missingBlockIds.size} missing blocks...`)
  const allIds = Array.from(missingBlockIds)

  for (let i = 0; i < allIds.length; i += 50) {
    const chunk = allIds.slice(i, i + 50)
    try {
      const result = (await (notion as any).getBlocks(chunk)) as any
      if (result?.recordMap) {
        mergedMap = mergeRecordMaps(mergedMap, result.recordMap as ExtendedRecordMap)
      }
    } catch (err) {
      console.error(`[Notion] Failed to batch-recover blocks chunk ${i}:`, err)
    }
  }

  return mergedMap
}

/**
 * Fetches and enriches data for linked collections embedded on a page.
 *
 * Only processes views that are actually embedded in the page's content tree
 * (collection_view / collection_view_page blocks), not all views leaked into
 * the record map from the parent collection. This prevents individual blog
 * posts from triggering the full multi-database fetch pipeline.
 *
 * Pipeline:
 * 1. `getCollectionData` per linked view → query results + missing block IDs
 * 2. `getPage` per linked database → fresh complete article list (catches new articles)
 * 3. Gather page_sort block IDs from relevant views → add to missing set
 * 4. `getBlocks` in 50-item chunks → batch-recover block content
 */
export async function fetchLinkedCollections(
  recordMap: ExtendedRecordMap,
  pageId: string
): Promise<ExtendedRecordMap> {
  let mergedMap = recordMap
  const missingBlockIds = new Set<string>()

  // Only process views actually embedded in this page's content.
  // Notion's getPage returns ALL views from the parent collection, but most
  // are irrelevant for individual blog posts.
  const embeddedViewIds = getEmbeddedViewIds(mergedMap, pageId)
  const viewIds = embeddedViewIds
    ? Array.from(embeddedViewIds)
    : Object.keys(mergedMap.collection_view || {})

  if (viewIds.length === 0) return mergedMap

  // Identify linked views that need query results + collect linked collection IDs
  const tasksToFetch: { cid: string; vid: string }[] = []
  const linkedCollectionIds = new Set<string>()

  for (const vid of viewIds) {
    const view = unwrap(mergedMap.collection_view[vid])
    const cid: string | undefined = view?.format?.collection_pointer?.id
    if (!cid) continue

    linkedCollectionIds.add(cid)
    if (!mergedMap.collection_query?.[cid]?.[vid]) {
      tasksToFetch.push({ cid, vid })
    }
  }

  if (tasksToFetch.length > 0) {
    console.log(`[Notion] Fetching ${tasksToFetch.length} linked collections...`)

    // Step 1: Fetch collection query data
    const linkedMaps = await fetchCollectionQueryData(tasksToFetch, missingBlockIds)
    for (const lrm of linkedMaps) {
      mergedMap = mergeRecordMaps(mergedMap, lrm)
    }
  }

  // Step 2: Fetch linked database parent pages for fresh article discovery.
  // Guard with a TTL to avoid redundant API calls when the FS page cache is warm.
  if (linkedCollectionIds.size > 0) {
    const now = Date.now()
    const staleIds = new Set(
      Array.from(linkedCollectionIds).filter(
        (cid) => !recentParentFetches.has(cid) || now - recentParentFetches.get(cid)! > PARENT_FETCH_TTL_MS
      )
    )

    if (staleIds.size > 0) {
      mergedMap = await fetchLinkedDatabasePages(staleIds, mergedMap, missingBlockIds)
      staleIds.forEach((cid) => recentParentFetches.set(cid, now))
    }
  }

  // Step 3: Gather page_sort block IDs from relevant views only
  for (const vid of viewIds) {
    const view = unwrap(mergedMap.collection_view[vid])
    view?.page_sort?.forEach((id: string) => {
      if (!mergedMap.block[id]) missingBlockIds.add(id)
    })
  }

  // Step 4: Batch-recover missing blocks
  mergedMap = await recoverMissingBlocks(mergedMap, missingBlockIds)

  return mergedMap
}
