import { getPageBlock } from './notion-helpers'
import type * as types from './types'

export default async function pageAcl({
  site,
  recordMap,
  pageId
}: types.PageProps): Promise<types.PageProps> {
  if (!site || !recordMap) {
    return {
      error: {
        statusCode: 404,
        message: 'Unable to resolve Notion page.'
      }
    }
  }
  const block = getPageBlock(recordMap, pageId)
  if (!block) {
    return {
      error: {
        statusCode: 404,
        message: `Notion page "${pageId}" has no root block.`
      }
    }
  }
  if (
    block.space_id &&
    site.rootNotionSpaceId &&
    block.space_id !== site.rootNotionSpaceId
  ) {
    return {
      error: {
        statusCode: 404,
        message: `Notion page "${pageId}" does not belong to this workspace.`
      }
    }
  }
  return {}
}
