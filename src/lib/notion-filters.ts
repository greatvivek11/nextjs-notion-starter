import { ExtendedRecordMap } from 'notion-types'
import {
  unwrap,
  extractPropertyValue,
  resolveTargetDate
} from './notion-helpers'

export interface ResolvedFilter {
  targetPropId: string
  propertyId: string
  operator: string
  targetValue: any
}

/** Returns true if a block satisfies a single resolved filter. */
export function blockMatchesFilter(block: any, filter: ResolvedFilter): boolean {
  const { targetPropId, propertyId, operator, targetValue } = filter

  // Prefer the ID that actually exists on the block
  const actualPropId = block.properties[targetPropId] ? targetPropId : propertyId
  const rawValue = block.properties[actualPropId]
  if (!rawValue) return false

  const { text, date } = extractPropertyValue(rawValue)

  if (operator === 'enum_contains' || operator === 'enum_does_not_contain') {
    const tags = text.split(',').map((v: string) => v.trim())
    const targets = Array.isArray(targetValue) ? targetValue : [targetValue]
    const isMatch = targets.some((t: any) => {
      const val = typeof t === 'string' ? t : (t?.value ?? t)
      return tags.includes(val)
    })
    return operator === 'enum_contains' ? isMatch : !isMatch
  }

  if (operator === 'date_is_on_or_after' && date) {
    const targetDate = resolveTargetDate(targetValue)
    return targetDate ? date >= targetDate : true
  }

  return true
}

/**
 * Resolves a view's property filters against its schema, returning typed filter objects.
 * Maps filter property IDs across schemas (e.g. 'Tags' in linked vs source collection).
 */
export function resolveViewFilters(
  propertyFilters: any[],
  sourceSchema: Record<string, any>,
  targetSchema: Record<string, any>
): ResolvedFilter[] {
  return propertyFilters
    .map((pf: any) => {
      const filterData = pf.filter
      if (!filterData?.property || !filterData.filter) return null

      const targetPropId = filterData.property
      const targetPropName = targetSchema[targetPropId]?.name

      // Find the matching property ID in the source schema by name
      let realPropId = targetPropId
      if (targetPropName) {
        const match = Object.entries(sourceSchema).find(([, v]: [string, any]) => v.name === targetPropName)
        if (match) realPropId = match[0]
      }

      return {
        targetPropId,
        propertyId: realPropId,
        operator: filterData.filter.operator,
        targetValue: filterData.filter.value
      } satisfies ResolvedFilter
    })
    .filter(Boolean) as ResolvedFilter[]
}

/**
 * Determines the candidate block IDs to filter for a given view.
 *
 * Strategy:
 * - Linked views (targetCollectionId ≠ collectionId): use parentage-based lookup merged
 *   with page_sort. Parentage is always fresh and catches newly added articles that
 *   haven't propagated to the linked view's stale cache yet.
 * - Non-linked views: use page_sort (most accurate pre-sorted list from Notion).
 * - Fallback: raw collection_query blockIds.
 */
export function resolveBlockIdsForView(
  recordMap: ExtendedRecordMap,
  view: any,
  collectionId: string,
  targetCollectionId: string,
  fallbackBlockIds: string[]
): string[] {
  if (targetCollectionId !== collectionId) {
    // For linked views, parentage lookup is authoritative (catches new articles)
    const byParentage = Object.values(recordMap.block)
      .map(unwrap)
      .filter((v: any) => v?.properties && (v.parent_id === targetCollectionId || v.collection_id === targetCollectionId))
      .map((v: any) => v.id)

    if (byParentage.length > 0) {
      const fromPageSort: string[] = view?.page_sort || []
      return Array.from(new Set([...fromPageSort, ...byParentage]))
    }

    return view?.page_sort?.length > 0 ? view.page_sort : fallbackBlockIds
  }

  // Non-linked view: page_sort is most accurate
  return view?.page_sort?.length > 0 ? view.page_sort : fallbackBlockIds
}

/**
 * Applies Notion view property filters to each collection's query results in-place.
 * This enables dynamic filtering (e.g. "date is on or after one month ago") that
 * Notion's API doesn't evaluate server-side for linked database views.
 */
export function applyFormatPropertyFilters(recordMap: ExtendedRecordMap): void {
  if (!recordMap.collection_query || !recordMap.collection_view || !recordMap.collection || !recordMap.block) {
    return
  }

  for (const [collectionId, viewQueries] of Object.entries(recordMap.collection_query)) {
    const sourceCollection = unwrap(recordMap.collection[collectionId])
    const sourceSchema = sourceCollection?.schema
    if (!sourceSchema) continue

    for (const [viewId, queryEntry] of Object.entries(viewQueries)) {
      const view = unwrap(recordMap.collection_view[viewId])
      const propertyFilters = view?.format?.property_filters
      if (!propertyFilters || !Array.isArray(propertyFilters)) continue

      const results = queryEntry.collection_group_results
      if (!results?.blockIds) continue

      const targetCollectionId: string = view.format?.collection_pointer?.id || collectionId
      const targetCollection = unwrap(recordMap.collection[targetCollectionId])
      const targetSchema = targetCollection?.schema || sourceSchema

      const resolvedFilters = resolveViewFilters(propertyFilters, sourceSchema, targetSchema)
      const candidateIds = resolveBlockIdsForView(recordMap, view, collectionId, targetCollectionId, results.blockIds)

      const filteredBlockIds = candidateIds.filter((blockId) => {
        const block = unwrap(recordMap.block[blockId])
        if (!block?.properties) return false
        return resolvedFilters.every((filter) => blockMatchesFilter(block, filter))
      })

      recordMap.collection_query[collectionId][viewId] = {
        ...queryEntry,
        collection_group_results: { ...results, blockIds: filteredBlockIds }
      }
    }
  }
}
