'use client'

import * as React from 'react'
import Link from 'next/link'
import { formatDate, normalizeTitle } from 'notion-utils'

export function propertyLastEditedTimeValue(
  { block, pageHeader }: { block: any; pageHeader: boolean },
  defaultFn: () => React.ReactNode
): React.ReactNode {
  if (pageHeader && block?.last_edited_time) {
    return `Last updated ${formatDate(block?.last_edited_time, {
      month: 'long'
    })}`
  }
  return defaultFn()
}

export const propertyDateValue = (
  { data, schema, pageHeader }: { data: any; schema: any; pageHeader: boolean },
  defaultFn: () => React.ReactNode
) => {
  if (pageHeader && schema?.name?.toLowerCase() === 'published') {
    const publishDate = data?.[0]?.[1]?.[0]?.[1]?.start_date
    if (publishDate) {
      return formatDate(publishDate, { month: 'long' })
    }
  }
  return defaultFn()
}

export function propertyTextValue(
  { schema, pageHeader }: { schema: any; pageHeader: boolean },
  defaultFn: () => React.ReactNode
): React.ReactNode {
  if (pageHeader && schema?.name?.toLowerCase() === 'author') {
    return <b>{defaultFn()}</b>
  }
  return defaultFn()
}

export function propertySelectValue(
  { schema, value, key, pageHeader }: { schema: any; value: any; key: any; pageHeader: boolean },
  defaultFn: () => React.ReactNode
): React.ReactNode {
  const normValue = normalizeTitle(value)
  if (pageHeader && schema.type === 'multi_select' && normValue) {
    return (
      <Link href={`/tags/${normValue}`} key={key}>
        {defaultFn()}
      </Link>
    )
  }
  return defaultFn()
}
