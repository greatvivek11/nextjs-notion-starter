import { api } from './config'
import * as types from './types'

const cache = new Map<
  string,
  { data: types.SearchResults; timestamp: number }
>()
const TTL = 10000

export async function searchNotion(
  params: types.SearchParams
): Promise<types.SearchResults> {
  const cacheKey = JSON.stringify(params)
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < TTL) {
    return cached.data
  }

  const res = await fetch(api.searchNotion, {
    method: 'POST',
    body: JSON.stringify(params),
    headers: {
      'content-type': 'application/json'
    }
  })

  if (!res.ok) {
    console.warn('[Search] Request failed', { status: res.status })
    throw new Error(`Search is temporarily unavailable (HTTP ${res.status}).`)
  }

  const data = await res.json()
  cache.set(cacheKey, { data, timestamp: Date.now() })
  while (cache.size > 50) {
    cache.delete(cache.keys().next().value)
  }
  return data
}
