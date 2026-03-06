import type { ExtendedRecordMap } from 'notion-types'
import { parsePageId } from 'notion-utils'
import * as acl from './acl'
import { pageUrlAdditions, pageUrlOverrides, site } from './config'
import { getSiteMap } from './get-site-map'
import { getPage } from './notion'
import type { PageProps, Site } from './types'

export async function resolveNotionPage(
  rawPageId?: string
): Promise<PageProps> {
  let pageId: string
  let recordMap: ExtendedRecordMap

  if (rawPageId && rawPageId !== 'index') {
    pageId = parsePageId(rawPageId)

    if (!pageId) {
      // check if the site configuration provides an override or a fallback for
      // the page's URI
      const override =
        pageUrlOverrides[rawPageId] || pageUrlAdditions[rawPageId]

      if (override) {
        pageId = parsePageId(override)
      }
    }

    if (pageId) {
      recordMap = await getPage(pageId)
    } else {
      // handle mapping of user-friendly canonical page paths to Notion page IDs
      // e.g., /developer-x-entrepreneur versus /71201624b204481f862630ea25ce62fe
      const siteMap = await getSiteMap()
      pageId = siteMap?.canonicalPageMap[rawPageId]

      if (pageId) {
        // TODO: we're not re-using the page recordMap from siteMaps because it is
        // cached aggressively
        // recordMap = siteMap.pageMap[pageId]

        recordMap = await getPage(pageId)
      } else {
        // note: we're purposefully not caching URI to pageId mappings for 404s
        return {
          site: undefined,
          recordMap: undefined,
          pageId,
          error: {
            message: `Not found "${rawPageId}"`,
            statusCode: 404
          }
        }
      }
    }
  } else {
    pageId = site.rootNotionPageId

    recordMap = await getPage(pageId)
  }

  const props = { site, recordMap, pageId }
  return { ...props, ...(await acl.default(props)) }
}
