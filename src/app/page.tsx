import { PHASE_PRODUCTION_BUILD } from 'next/constants'

import { ErrorPage } from '@/components/ErrorPage'
import { NotionPage } from '@/components/NotionPage'
import { appConfig } from '@/lib/config'
import { buildPageMetadata } from '@/lib/metadata-builder'
import { resolvePageModel } from '@/lib/page-model'
import { resolveNotionPage } from '@/lib/resolve-notion-page'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export const revalidate = 3600
// Give cold/uncached Notion pages enough headroom to complete their retry budget
// (see notionMaxRetryBudget in lib/config.ts) instead of being killed mid-request.
export const maxDuration = 45

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
  try {
    const resolvedPage = await resolveNotionPage()

    return (
      <>
        <SpeedInsights />
        <Analytics />
        <NotionPage {...resolvedPage} />
      </>
    )
  } catch (err) {
    // Only swallow the error during the build's static-generation pass, so a
    // transient Notion outage doesn't fail the entire deployment. At runtime
    // (request time), rethrow so the app's error boundary (src/app/error.tsx)
    // handles it normally and the request correctly reports a failure.
    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
      console.warn('[Build] Failed to resolve root Notion page during build. Rendering fallback.', err)
      return <ErrorPage statusCode={503} />
    }
    throw err
  }
}
