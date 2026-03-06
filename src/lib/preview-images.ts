import type {
  ExtendedRecordMap,
  PreviewImage,
  PreviewImageMap
} from 'notion-types'
import { getPageImageUrls, normalizeUrl } from 'notion-utils'
import { defaultPageCover, defaultPageIcon } from './config'
import { mapImageUrl } from './map-image-url'

export async function getPreviewImageMap(
  recordMap: ExtendedRecordMap
): Promise<PreviewImageMap> {
  const urls: string[] = getPageImageUrls(recordMap, {
    mapImageUrl
  })
    .concat([defaultPageIcon, defaultPageCover])
    .filter(Boolean)

  const previewImagesMap = Object.fromEntries(
    await Promise.all(
      urls.map(async (url) => {
        const cacheKey = normalizeUrl(url)
        return [cacheKey, await getPreviewImage(url, { cacheKey })]
      })
    )
  )

  return previewImagesMap
}

const previewImageCache = new Map<string, PreviewImage | null>()

async function createPreviewImage(
  url: string,
  { cacheKey }: { cacheKey: string }
): Promise<PreviewImage | null> {
  // LQIP is disabled to speed up builds.
  // We return null here which effectively tells the renderer there's no preview image.
  return null
}

export const getPreviewImage = async (
  url: string,
  { cacheKey }: { cacheKey: string }
): Promise<PreviewImage | null> => {
  if (previewImageCache.has(cacheKey)) {
    return previewImageCache.get(cacheKey)!
  }

  const result = await createPreviewImage(url, { cacheKey })
  previewImageCache.set(cacheKey, result)
  return result
}
