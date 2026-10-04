import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse
) {
  const authHeader = request.headers['authorization']
  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return response.status(401).json({ success: false })
  }

  if (!process.env.CRON_URL) {
    console.error('[Cron] Missing CRON_URL')
    return response
      .status(503)
      .json({ success: false, error: 'Cron webhook is not configured.' })
  }
  try {
    const result = await fetch(process.env.CRON_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10000)
    })
    if (!result.ok) throw new Error(`Webhook returned HTTP ${result.status}`)
  } catch (error) {
    console.error('[Cron] Webhook failed', error)
    return response
      .status(502)
      .json({ success: false, error: 'Cron webhook failed.' })
  }

  response.status(200).json({ success: true })
}
