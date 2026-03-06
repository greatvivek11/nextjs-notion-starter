import { NotionPage } from '@/components/NotionPage'
import { domain } from '@/lib/config'
import { getSiteMap } from '@/lib/get-site-map'
import { resolveNotionPage } from '@/lib/resolve-notion-page'
import { PageProps } from '@/lib/types'
import omit from 'lodash.omit'
import type { ExtendedRecordMap } from 'notion-types'
import { normalizeTitle } from 'notion-utils'

export const runtime = 'nodejs'

const tagsPropertyNameLowerCase = 'tags'

async function getPageProps(tagName: string): Promise<PageProps> {
  try {
    const props = await resolveNotionPage(process.env.BLOG_PAGE_ID)
    let propertyToFilterName: string = null

    if (props.recordMap) {
      const recordMap = props.recordMap as ExtendedRecordMap
      const collectionValue = Object.values(recordMap.collection)[0]
      const collection = (collectionValue as any)?.value || collectionValue

      if (collection) {
        const galleryViewValue = Object.values(recordMap.collection_view).find(
          (view: any) => (view?.value?.type || view?.type) === 'gallery'
        )
        const galleryView = (galleryViewValue as any)?.value || galleryViewValue

        if (galleryView) {
          const galleryBlockEntry = Object.values(recordMap.block).find(
            (block: any) => {
              const blockValue = block?.value || block
              return (
                blockValue?.type === 'collection_view' &&
                blockValue.view_ids?.includes(galleryView.id)
              )
            }
          )
          const galleryBlock =
            (galleryBlockEntry as any)?.value || galleryBlockEntry

          if (galleryBlock) {
            recordMap.block = {
              [galleryBlock.id]: galleryBlockEntry as any,
              ...omit(recordMap.block, [galleryBlock.id])
            }

            const propertyToFilter = Object.entries(
              collection.schema as any
            ).find(
              (property: any) =>
                property[1]?.name?.toLowerCase() === tagsPropertyNameLowerCase
            )

            const propertyToFilterId = propertyToFilter?.[0]
            const filteredValue = normalizeTitle(tagName)
            propertyToFilterName =
              (propertyToFilter?.[1] as any)?.options?.find(
                (option: any) => normalizeTitle(option.value) === filteredValue
              )?.value ?? null

            if (propertyToFilterId && filteredValue) {
              const query =
                recordMap.collection_query[collection.id]?.[galleryView.id]
              const queryResults = query?.collection_group_results ?? query

              if (queryResults) {
                queryResults.blockIds = queryResults.blockIds.filter((id) => {
                  const blockEntry = recordMap.block[id]
                  const block = (blockEntry as any)?.value || blockEntry
                  if (!block || !block.properties) {
                    return false
                  }

                  const value = block.properties[propertyToFilterId]?.[0]?.[0]
                  if (!value) {
                    return false
                  }

                  const values = value.split(',')
                  if (
                    !values.find(
                      (value: string) => normalizeTitle(value) === filteredValue
                    )
                  ) {
                    return false
                  }

                  return true
                })
              }
            }
          }
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
  const siteMap = await getSiteMap()
  return Object.keys(siteMap.canonicalPageMap).map((pageId) => ({
    tagName: pageId
  }))
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
