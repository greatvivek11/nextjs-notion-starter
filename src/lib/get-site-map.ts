import { getAllPagesInSpace, getPageProperty } from 'notion-utils'
// import pMemoize from 'p-memoize'
import { rootNotionPageId, rootNotionSpaceId, site } from './config'

import { includeNotionIdInUrls } from './config'
import { getCanonicalPageId } from './get-canonical-page-id'
import { notion } from './notion-api'
import * as types from './types'

const uuid = !!includeNotionIdInUrls

export async function getSiteMap(): Promise<types.SiteMap> {
  const partialSiteMap = await getAllPages(rootNotionPageId, rootNotionSpaceId)

  return {
    site: site,
    ...partialSiteMap
  } as types.SiteMap
}

const cache = new Map<string, Partial<types.SiteMap>>()

const getAllPages = async (
  rootNotionPageId: string,
  rootNotionSpaceId: string
): Promise<Partial<types.SiteMap>> => {
  const cacheKey = JSON.stringify({ rootNotionPageId, rootNotionSpaceId })
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!
  }

  const result = await getAllPagesImpl(rootNotionPageId, rootNotionSpaceId)
  cache.set(cacheKey, result)
  return result
}

async function getAllPagesImpl(
  rootNotionPageId: string,
  rootNotionSpaceId: string
): Promise<Partial<types.SiteMap>> {
  const getPage = async (pageId: string, ...args) => {
    // console.log('\nnotion getPage', uuidToId(pageId))
    return notion.getPage(pageId, { signFileUrls: false, ...args[0] })
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
