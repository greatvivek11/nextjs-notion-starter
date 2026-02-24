import { Block } from 'notion-types'

import { defaultPageCover, defaultPageIcon } from './config'

export const mapImageUrl = (url: string, block: Block) => {
  if (!url) {
    return undefined
  }

  if (url === defaultPageCover || url === defaultPageIcon) {
    return url
  }

  // data: URIs and local /images paths don't need proxying
  if (url.startsWith('data:')) {
    return url
  }

  if (url.startsWith('/images')) {
    url = `https://www.notion.so${url}`
  }

  // Proxy all external images through Notion's image service to avoid
  // ERR_BLOCKED_BY_ORB / CORS issues with direct cross-origin loads
  // (e.g. unsplash, S3 signed URLs, GIFs)
  url = `https://www.notion.so${
    url.startsWith('/image') ? url : `/image/${encodeURIComponent(url)}`
  }`

  const notionImageUrl = new URL(url)
  let table = block.parent_table === 'space' ? 'block' : block.parent_table
  if (table === 'collection' || table === 'team') {
    table = 'block'
  }
  notionImageUrl.searchParams.set('table', table)
  notionImageUrl.searchParams.set('id', block.id)
  notionImageUrl.searchParams.set('cache', 'v2')

  return notionImageUrl.toString()
}
