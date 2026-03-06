'use server'
import { ExtendedRecordMap, SearchParams, SearchResults } from 'notion-types'
import { mergeRecordMaps, parsePageId } from 'notion-utils'
import pMap from 'p-map'
import {
  // isPreviewImageSupportEnabled,
  navigationLinks,
  navigationStyle
} from './config'
import { notion } from './notion-api'
import { getPreviewImageMap } from './preview-images'

const withRetry = async <T>(
  fn: () => Promise<T>,
  retries = 8,
  delay = 1000
): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err: any) {
      if (i === retries - 1) throw err

      // Use longer delay for rate limit errors
      const is429 =
        err.message?.includes('429') ||
        err.status === 429 ||
        err.statusCode === 429
      const currentDelay = is429 ? Math.max(delay, 3000) : delay

      console.warn(
        `[Notion API Retry ${i + 1}/${retries}] ${
          is429 ? '(Rate Limited) ' : ''
        }Failed: ${err.message}. Retrying in ${currentDelay}ms...`
      )
      await new Promise((resolve) => setTimeout(resolve, currentDelay))
      delay *= 2
    }
  }
  throw new Error('Unreachable')
}

const getNavigationLinkPages = async (): Promise<ExtendedRecordMap[]> => {
  const navigationLinkPageIds = (navigationLinks || [])
    .map((link) => link?.pageId)
    .filter(Boolean)

  if (navigationStyle !== 'default' && navigationLinkPageIds.length) {
    return pMap(
      navigationLinkPageIds,
      async (navigationLinkPageId) =>
        withRetry(() =>
          notion.getPage(navigationLinkPageId, {
            chunkLimit: 1,
            fetchMissingBlocks: false,
            fetchCollections: false,
            signFileUrls: true
          })
        ),
      {
        concurrency: 4
      }
    )
  }

  return []
}

export async function getPage(pageId: string): Promise<ExtendedRecordMap> {
  let recordMap = await withRetry(() =>
    notion.getPage(pageId, {
      // Disable signed URLs — they expire after ~1 hour and break SSG pages.
      // Images are proxied through notion.so/image/ via mapImageUrl.
      // PDFs are handled by our custom /api/notion-pdf proxy which signs on demand.
      signFileUrls: false
    })
  )

  if (navigationStyle !== 'default') {
    // ensure that any pages linked to in the custom navigation header have
    // their block info fully resolved in the page record map so we know
    // the page title, slug, etc.
    const navigationLinkRecordMaps = await getNavigationLinkPages()

    if (navigationLinkRecordMaps?.length) {
      recordMap = navigationLinkRecordMaps.reduce(
        (map, navigationLinkRecordMap) =>
          mergeRecordMaps(map, navigationLinkRecordMap),
        recordMap
      )
    }
  }

  // if (isPreviewImageSupportEnabled) {
  //   const previewImageMap = await getPreviewImageMap(recordMap);
  //   recordMap.preview_images = previewImageMap
  // }

  return recordMap
}

export async function search(params: SearchParams): Promise<SearchResults> {
  const headers: Record<string, string> = {
    Accept: '*/*',
    'Content-Type': 'application/json'
  }

  // Pass auth token for authenticated search (higher rate limits + private pages)
  if (process.env.NOTION_TOKEN) {
    headers.cookie = `token_v2=${process.env.NOTION_TOKEN}`
  }

  return fetch('https://www.notion.so/api/v3/search', {
    method: 'POST',
    body: JSON.stringify({
      type: 'BlocksInAncestor',
      query: params.query,
      ancestorId: parsePageId(params.ancestorId),
      sort: {
        field: 'relevance'
      },
      limit: 20,
      source: 'quick_find_input_change',
      filters: {
        isDeletedOnly: false,
        isNavigableOnly: false,
        excludeTemplates: false,
        requireEditPermissions: false,
        ancestors: [],
        createdBy: [],
        editedBy: [],
        lastEditedTime: {},
        createdTime: {}
      }
    }),
    headers
  }).then((res) => res.json())
}
