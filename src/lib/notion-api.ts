import { NotionAPI } from 'notion-client'
import { notionRequestTimeout } from './config'

export const notion = new NotionAPI({
  apiBaseUrl: process.env.NOTION_API_BASE_URL,
  ofetchOptions: {
    // Notion rejects the default Node.js User-Agent with a Cloudflare 403.
    headers: { 'User-Agent': 'nextjs-notion-starter' },
    retry: 0,
    onRequest({ options }) {
      // Collection queries override constructor timeouts; a signal covers every endpoint.
      const timeout = AbortSignal.timeout(notionRequestTimeout)
      options.signal = options.signal
        ? AbortSignal.any([options.signal, timeout])
        : timeout
    }
  }
})
