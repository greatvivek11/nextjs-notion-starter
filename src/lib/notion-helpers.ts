/**
 * Helpers for extracting typed values from Notion's nested API response shapes.
 * Notion wraps many objects in double/triple value layers; these utilities normalize that.
 */

import { ExtendedRecordMap } from 'notion-types'

/** Unwraps Notion's nested value wrappers (value.value, value, or identity) */
export function unwrap(entry: any): any {
  return entry?.value?.value ?? entry?.value ?? entry
}

/**
 * Extracts the plain-text string and date (if any) from a Notion property value array.
 * Property values are stored as rich-text segment arrays: [[text, attrs?], ...]
 */
export function extractPropertyValue(propertyValArray: any[]): { text: string; date: Date | null } {
  let text = ''
  let date: Date | null = null

  if (Array.isArray(propertyValArray)) {
    text = propertyValArray.map((segment: any) => segment[0]).join('')

    for (const segment of propertyValArray) {
      const attrs = segment[1]
      if (attrs) {
        const dateAttr = attrs.find((a: any) => a[0] === 'd')
        if (dateAttr?.start_date) {
          date = new Date(dateAttr.start_date)
          break
        }
        if (dateAttr?.[1]?.start_date) {
          date = new Date(dateAttr[1].start_date)
          break
        }
      }
    }
  }

  return { text, date }
}

/**
 * Resolves a "relative" Notion date filter value to an absolute Date.
 * e.g. { type: 'relative', value: 'one_month_ago' } → Date one month before now.
 */
export function resolveTargetDate(targetValue: any): Date | null {
  if (targetValue?.type === 'relative') {
    if (targetValue.value === 'one_month_ago') {
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      return d
    }
    return null
  }
  if (targetValue?.type === 'exact' && targetValue.value?.start_date) {
    return new Date(targetValue.value.start_date)
  }
  return null
}

/**
 * Finds all block IDs from a database page's collection queries.
 * Used to discover articles that Notion's linked view cache may have missed.
 */
export function extractBlockIdsFromCollectionQuery(
  collectionQuery: ExtendedRecordMap['collection_query']
): string[] {
  const ids: string[] = []
  for (const viewMap of Object.values(collectionQuery || {})) {
    for (const queryData of Object.values(viewMap as any)) {
      const bIds: string[] = (queryData as any)?.collection_group_results?.blockIds || []
      ids.push(...bIds)
    }
  }
  return ids
}
