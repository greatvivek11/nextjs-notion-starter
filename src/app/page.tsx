import { PHASE_PRODUCTION_BUILD } from 'next/constants'
import { connection } from 'next/server'

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
    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
      console.warn('[Build] Failed to resolve root Notion page. Deferring rendering to request time.', err)
      // Avoid caching an error UI with HTTP 200 for the entire ISR interval.
      await connection()
    }
    throw err
  }
}
