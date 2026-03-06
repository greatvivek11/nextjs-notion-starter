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

  await fetch(`${process.env.CRON_URL}`, {
    method: 'POST'
  })

  response.status(200).json({ success: true })
}
