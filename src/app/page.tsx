import { NotionPage } from '@/components/NotionPage'
import { domain } from '@/lib/config'
import { resolveNotionPage } from '@/lib/resolve-notion-page'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
export const revalidate = 60

async function getNotionPages() {
  try {
    return await resolveNotionPage()
  } catch (err) {
    console.error('page error', domain, err)
    throw err
  }
}

export default async function Page() {
  const props = await getNotionPages()
  return (
    <>
      <SpeedInsights />
      <Analytics />
      <NotionPage {...props} />
    </>
  )
}
