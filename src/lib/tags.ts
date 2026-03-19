import type { ExtendedRecordMap } from 'notion-types'
import { normalizeTitle } from 'notion-utils'

const tagsPropertyNameLowerCase = 'tags'

function getCollection(recordMap: ExtendedRecordMap) {
  const collectionValue = Object.values(recordMap.collection || {})[0]
  return (collectionValue as any)?.value || collectionValue
}

function getGalleryView(recordMap: ExtendedRecordMap) {
  const galleryViewValue = Object.values(recordMap.collection_view || {}).find(
    (view: any) => (view?.value?.type || view?.type) === 'gallery'
  )
  return (galleryViewValue as any)?.value || galleryViewValue
}

export function getTagsContext(recordMap: ExtendedRecordMap) {
  const collection = getCollection(recordMap)
  if (!collection) {
    return null
  }

  const propertyToFilter = Object.entries(collection.schema || {}).find(
    (property: any) =>
      property[1]?.name?.toLowerCase() === tagsPropertyNameLowerCase
  )
  const propertyToFilterId = propertyToFilter?.[0]

  if (!propertyToFilterId) {
    return null
  }

  const galleryView = getGalleryView(recordMap)
  const query = galleryView
    ? recordMap.collection_query?.[collection.id]?.[galleryView.id]
    : null
  const queryResults = query?.collection_group_results ?? query ?? null

  return {
    collection,
    galleryView,
    propertyToFilter,
    propertyToFilterId,
    queryResults
  }
}

export function extractTagNames(recordMap: ExtendedRecordMap): string[] {
  const context = getTagsContext(recordMap)
  if (!context) {
    return []
  }

  const tags = new Map<string, string>()
  const options = (context.propertyToFilter?.[1] as any)?.options || []

  for (const option of options) {
    if (option?.value) {
      tags.set(normalizeTitle(option.value), option.value)
    }
  }

  for (const blockId of context.queryResults?.blockIds || []) {
    const blockEntry = recordMap.block?.[blockId]
    const block = (blockEntry as any)?.value || blockEntry
    const value = block?.properties?.[context.propertyToFilterId]?.[0]?.[0]

    if (!value) {
      continue
    }

    for (const tag of value.split(',')) {
      const trimmedTag = tag.trim()
      if (trimmedTag) {
        tags.set(normalizeTitle(trimmedTag), trimmedTag)
      }
    }
  }

  return Array.from(tags.values())
}
