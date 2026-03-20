import { ResolvedPage } from '@/types'
import { ExtendedRecordMap } from 'notion-types'
import { normalizeTitle } from 'notion-utils'
import { resolveNotionPage } from './resolve-notion-page'
import { extractTagNames, getTagsContext } from './tags'

/**
 * Resolves a tag-filtered page by fetching the blog root and filtering results in-memory.
 */
export async function resolveTagPage(tagName: string): Promise<ResolvedPage> {
  const blogPageId = process.env.BLOG_PAGE_ID
  if (!blogPageId) {
    throw new Error('Missing BLOG_PAGE_ID environment variable')
  }

  const props = await resolveNotionPage(blogPageId)
  if (!props.recordMap) {
    return props as ResolvedPage
  }

  const recordMap = props.recordMap as ExtendedRecordMap
  const tagsContext = getTagsContext(recordMap)
  let propertyToFilterName: string = null

  if (tagsContext) {
    const filteredValue = normalizeTitle(tagName)

    // Resolve the display name for the tag
    propertyToFilterName =
      (tagsContext.propertyToFilter?.[1] as any)?.options?.find(
        (option: any) => normalizeTitle(option.value) === filteredValue
      )?.value ?? null

    // Ensure the gallery view block is at the top of the block list if it exists
    if (tagsContext.galleryView) {
      const galleryBlockEntry = Object.values(recordMap.block).find(
        (block: any) => {
          const blockValue = block?.value || block
          return (
            blockValue?.type === 'collection_view' &&
            blockValue.view_ids?.includes(tagsContext.galleryView.id)
          )
        }
      )
      const galleryBlock =
        (galleryBlockEntry as any)?.value || galleryBlockEntry

      if (galleryBlock) {
        const { [galleryBlock.id]: _removed, ...restBlocks } = recordMap.block
        recordMap.block = {
          [galleryBlock.id]: galleryBlockEntry as any,
          ...restBlocks
        }
      }
    }

    // Filter the collection results in-memory
    if (tagsContext.queryResults && filteredValue) {
      tagsContext.queryResults.blockIds =
        tagsContext.queryResults.blockIds.filter((id) => {
          const blockEntry = recordMap.block[id]
          const block = (blockEntry as any)?.value || blockEntry
          if (!block?.properties) {
            return false
          }

          const value =
            block.properties[tagsContext.propertyToFilterId]?.[0]?.[0]
          if (!value) {
            return false
          }

          return value
            .split(',')
            .some((tag: string) => normalizeTitle(tag) === filteredValue)
        })
    }
  }

  return {
    ...(props as any),
    tagsPage: true,
    propertyToFilterName
  }
}

/**
 * Gets all available tags for static param generation.
 */
export async function getAllTags(): Promise<string[]> {
  const blogPageId = process.env.BLOG_PAGE_ID
  if (!blogPageId) {
    return []
  }

  const props = await resolveNotionPage(blogPageId)
  const recordMap = props.recordMap as ExtendedRecordMap | undefined
  if (!recordMap) {
    return []
  }

  return extractTagNames(recordMap)
}
