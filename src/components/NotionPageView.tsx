import { notFound } from 'next/navigation'
import { resolvePageModel } from '@/lib/page-model'
import type { ResolvedPage } from '@/types'
import { Footer } from './Footer'
import { NotionPage } from './NotionPage'

export function NotionPageView(props: ResolvedPage) {
  if (props.error?.statusCode === 404 || !props.recordMap) notFound()
  return (
    <NotionPage
      {...props}
      pageModel={resolvePageModel(props)}
      footer={<Footer />}
    />
  )
}
