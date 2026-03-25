import { ResolvedPage } from '@/types'
import type { ExtendedRecordMap } from 'notion-types'
import { parsePageId } from 'notion-utils'
import * as acl from './acl'
import { appConfig } from './config'
import { getSiteMap } from './get-site-map'
import { getPage } from './notion'

/**
 * Resolves a route to a Notion page, handling overrides and canonical slugs.
 */
export async function resolveNotionPage(
  rawPageId?: string
): Promise<ResolvedPage> {
  const { pageUrlOverrides, pageUrlAdditions, site } = appConfig
  let pageId: string
  let recordMap: ExtendedRecordMap

  if (rawPageId && rawPageId !== 'index') {
    pageId = parsePageId(rawPageId)

    if (!pageId) {
      const override =
        pageUrlOverrides[rawPageId] || pageUrlAdditions[rawPageId]
      if (override) {
        pageId = parsePageId(override)
      }
    }

    if (pageId) {
      recordMap = await getPage(pageId, 'resolveNotionPage')
    } else {
      const siteMap = await getSiteMap()
      pageId = siteMap?.canonicalPageMap[rawPageId]

      if (pageId) {
        recordMap = await getPage(pageId, 'resolveNotionPage:canonical')
      } else {
        return {
          site,
          recordMap: null,
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
    recordMap = await getPage(pageId, 'resolveNotionPage:root')
  }

  const props: ResolvedPage = { site, recordMap, pageId }
  return { ...props, ...(await acl.default(props as any)) }
}
