import { NextApiRequest, NextApiResponse } from 'next'
import { parsePageId } from 'notion-utils'
import { withRetry } from '@/lib/notion-retry'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { pageId, blockId } = req.query

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'method not allowed' })
  }
  if (typeof pageId !== 'string' || !parsePageId(pageId)) {
    console.warn('[PDF API] Invalid page ID')
    return res.status(400).json({ error: 'pageId query param is required' })
  }
  if (typeof blockId !== 'string' || !parsePageId(blockId)) {
    console.warn('[PDF API] Invalid block ID')
    return res.status(400).json({ error: 'blockId query param is required' })
  }

  try {
    const { notion } = await import('@/lib/notion-api')

    // Fetch the page with signFileUrls: true.
    // loadPageChunk works without auth for public Notion pages,
    // and addSignedUrls then signs all file URLs in that page context.
    const recordMap = await withRetry((signal) =>
      notion.getPage(pageId, {
        fetchMissingBlocks: true,
        fetchCollections: false,
        signFileUrls: true,
        ofetchOptions: { signal }
      })
    )

    // Extract the signed URL for our PDF block
    const signedUrl = recordMap?.signed_urls?.[blockId]

    if (!signedUrl) {
      return res.status(404).json({
        error: 'No signed URL found for this PDF block',
        availableKeys: Object.keys(recordMap?.signed_urls || {}).slice(0, 5)
      })
    }

    // Fetch the PDF binary from the signed URL (server-to-server)
    const pdfResponse = await fetch(signedUrl, {
      signal: AbortSignal.timeout(10000)
    })

    if (!pdfResponse.ok) {
      return res.status(pdfResponse.status).json({
        error: `PDF fetch returned ${pdfResponse.status}: ${pdfResponse.statusText}`
      })
    }

    const arrayBuffer = await pdfResponse.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', buffer.length)
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('Cache-Control', 'public, max-age=3000, s-maxage=3000')
    res.status(200).send(buffer)
  } catch (err) {
    console.error('API /api/notion-pdf Error:', err)
    res.status(502).json({ error: 'PDF is temporarily unavailable.' })
  }
}
