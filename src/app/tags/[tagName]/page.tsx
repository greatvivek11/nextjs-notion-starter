import { NotionPage } from '@/components/NotionPage'
import { domain } from '@/lib/config'
import { resolveNotionPage } from '@/lib/resolve-notion-page'
import { extractTagNames, getTagsContext } from '@/lib/tags'
import { PageProps } from '@/lib/types'
import type { ExtendedRecordMap } from 'notion-types'
import { normalizeTitle } from 'notion-utils'

export const revalidate = 60

async function getPageProps(tagName: string): Promise<PageProps> {
  try {
    const props = await resolveNotionPage(process.env.BLOG_PAGE_ID)
    let propertyToFilterName: string = null

    if (props.recordMap) {
      const recordMap = props.recordMap as ExtendedRecordMap
      const tagsContext = getTagsContext(recordMap)

      if (tagsContext?.galleryView) {
        const galleryBlockEntry = Object.values(recordMap.block).find(
          (block: any) => {
            const blockValue = block?.value || block
            return (
              blockValue?.type === 'collection_view' &&
              blockValue.view_ids?.includes(tagsContext.galleryView.id)
            )
          }
        )
        const galleryBlock = (galleryBlockEntry as any)?.value || galleryBlockEntry

        if (galleryBlock) {
          const { [galleryBlock.id]: _removed, ...restBlocks } = recordMap.block
          recordMap.block = {
            [galleryBlock.id]: galleryBlockEntry as any,
            ...restBlocks
          }
        }
      }

      if (tagsContext) {
        const filteredValue = normalizeTitle(tagName)
        propertyToFilterName =
          (tagsContext.propertyToFilter?.[1] as any)?.options?.find(
            (option: any) => normalizeTitle(option.value) === filteredValue
          )?.value ?? null

        if (tagsContext.queryResults && filteredValue) {
          tagsContext.queryResults.blockIds = tagsContext.queryResults.blockIds.filter(
            (id) => {
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
            }
          )
        }
      }
    }

    return {
      ...props,
      tagsPage: true,
      propertyToFilterName
    }
  } catch (err) {
    console.error('page error', domain, tagName, err)
    throw err
  }
}

export async function generateStaticParams() {
  if (!process.env.BLOG_PAGE_ID) {
    return []
  }

  try {
    const props = await resolveNotionPage(process.env.BLOG_PAGE_ID)
    const recordMap = props.recordMap as ExtendedRecordMap | undefined
    if (!recordMap) {
      return []
    }

    return extractTagNames(recordMap).map((tagName) => ({
      tagName: normalizeTitle(tagName)
    }))
  } catch (error) {
    console.warn('failed to generate static tag params', error)
    return []
  }
}

export default async function NotionTagsPage({
  params
}: {
  params: Promise<{ tagName: string }>
}) {
  const { tagName } = await params
  const pageProps = await getPageProps(tagName)
  return <NotionPage {...pageProps} />
}
