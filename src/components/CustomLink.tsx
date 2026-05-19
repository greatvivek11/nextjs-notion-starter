'use client'

import Link from 'next/link'
import { parsePageId } from 'notion-utils'
import * as React from 'react'

export const CustomLink: React.FC<{
  href?: string
  target?: string
  rel?: string
  className?: string
  children?: React.ReactNode
  [key: string]: unknown
}> = ({ href, target, rel, className, children, ...rest }) => {
  if (href && (href.includes('notion.site') || href.includes('notion.so'))) {
    try {
      const url = new URL(href)
      const pageId = parsePageId(url.pathname, { uuid: false })
      if (pageId) {
        return (
          <Link href={`/${pageId}${url.hash}`} className={className} {...rest}>
            {children}
          </Link>
        )
      }
    } catch (e) {
      // Ignore invalid URL errors and fall through to default external link
    }
  }

  return (
    <a
      href={href}
      target={target ?? '_blank'}
      rel={rel ?? 'noopener noreferrer'}
      className={className}
      {...rest}
    >
      {children}
    </a>
  )
}
