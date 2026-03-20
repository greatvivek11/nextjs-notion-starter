import { PageModel, ResolvedPage } from '@/types'
import { PageBlock } from 'notion-types'
import { getBlockTitle, getPageProperty } from 'notion-utils'
import { appConfig } from './config'
import { mapImageUrl } from './map-image-url'
import { getCanonicalPageUrl } from './map-page-url'

/**
 * Resolves a high-level PageModel from a raw ResolvedPage.
 *
 * This isolates the UI from Notion-specific block traversal and property lookups.
 */
export function resolvePageModel(resolvedPage: ResolvedPage): PageModel {
  const { recordMap, site, pageId, tagsPage, propertyToFilterName } =
    resolvedPage

  const keys = Object.keys(recordMap?.block || {})
  const blockEntry = recordMap?.block?.[keys[0]]
  const block =
    (blockEntry as any)?.value?.value ||
    (blockEntry as any)?.value ||
    blockEntry

  const isBlogPost =
    block?.type === 'page' && block?.parent_table === 'collection'

  const name = getBlockTitle(block, recordMap) || site.name
  const title =
    tagsPage && propertyToFilterName ? `${propertyToFilterName} ${name}` : name

  const socialDescription =
    getPageProperty<string>('Description', block, recordMap) ||
    appConfig.description

  const socialImage =
    mapImageUrl(
      getPageProperty<string>('Social Image', block, recordMap) ||
        (block as PageBlock).format?.page_cover ||
        appConfig.defaultPageCover,
      block
    ) ?? undefined

  const canonicalUrl = getCanonicalPageUrl(site, recordMap)(pageId)

  return {
    id: pageId,
    title,
    description: socialDescription,
    image: socialImage,
    url: canonicalUrl,
    canonicalUrl,
    isBlogPost,
    showTableOfContents: !!isBlogPost,
    minTableOfContentsItems: 3,
    // These defaults will be overridden by runtime context in the UI
    isLiteMode: false,
    isDarkMode: false,
    tagsPage: !!tagsPage,
    propertyToFilterName
  }
}
