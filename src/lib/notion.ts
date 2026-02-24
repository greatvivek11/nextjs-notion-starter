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

const getNavigationLinkPages = async (): Promise<ExtendedRecordMap[]> => {
  const navigationLinkPageIds = (navigationLinks || [])
    .map((link) => link?.pageId)
    .filter(Boolean)

  if (navigationStyle !== 'default' && navigationLinkPageIds.length) {
    return pMap(
      navigationLinkPageIds,
      async (navigationLinkPageId) =>
        notion.getPage(navigationLinkPageId, {
          chunkLimit: 1,
          fetchMissingBlocks: false,
          fetchCollections: false,
          signFileUrls: false
        }),
      {
        concurrency: 4
      }
    )
  }

  return []
}

export async function getPage(pageId: string): Promise<ExtendedRecordMap> {
  let recordMap = await notion.getPage(pageId, {
    // Disable signed URLs — they use img.notionusercontent.com which expires
    // quickly, causing 404s on statically generated pages.
    // Our custom mapImageUrl proxies images through notion.so/image/ instead.
    signFileUrls: false
  })

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
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/json'
    }
  }).then((res) => res.json())
}
