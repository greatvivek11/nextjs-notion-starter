import { NotionPage } from '@/components/NotionPage'
import { appConfig } from '@/lib/config'
import { buildPageMetadata } from '@/lib/metadata-builder'
import { resolvePageModel } from '@/lib/page-model'
import { resolveNotionPage } from '@/lib/resolve-notion-page'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export const revalidate = 3600

export async function generateMetadata() {
  try {
    const resolvedPage = await resolveNotionPage()
    const pageModel = resolvePageModel(resolvedPage)
    return buildPageMetadata(pageModel, appConfig)
  } catch (err) {
    return {}
  }
}

export default async function Page() {
  const resolvedPage = await resolveNotionPage()

  return (
    <>
      <SpeedInsights />
      <Analytics />
      <NotionPage {...resolvedPage} />
    </>
  )
}
