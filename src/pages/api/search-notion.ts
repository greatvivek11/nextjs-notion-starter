import { search } from '@/lib/notion'
import type * as types from '@/types'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).send({ error: 'method not allowed' })
  }

  if (
    !req.body ||
    typeof req.body !== 'object' ||
    typeof req.body.query !== 'string' ||
    req.body.query.length > 512
  ) {
    console.warn('[Search API] Invalid query')
    return res
      .status(400)
      .json({ error: 'query must be a string of at most 512 characters.' })
  }
  const searchParams: types.SearchParams = req.body
  try {
    const results = await search(searchParams)
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json(results)
  } catch (error) {
    console.error('[Search API] Upstream request failed', error)
    res
      .status(502)
      .json({ error: 'Search is temporarily unavailable. Please try again.' })
  }
}
