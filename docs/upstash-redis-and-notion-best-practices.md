# Upstash and public Notion integration

The project uses `notion-client` and `react-notion-x` to fetch/render public
Notion pages through unofficial endpoints. It does not use the supported
Notion integration SDK. Official API database examples and published integration
request limits must not be treated as contracts for this implementation.

## Keep the existing architecture

For a personal site, retaining faithful Notion rendering, compressed Redis,
and hourly ISR avoids a CMS/renderer migration. The tradeoff is upstream
compatibility risk: public-page endpoints and record shapes can change.

Use typed boundary guards, contextual diagnostics, and regression fixtures
for single/double-wrapped blocks, linked collections, navigation, and tag views.
Keep the renderer and Notion library family compatible when upgrading.

## Cache practices

- Configure Upstash from REST credentials server-side; never put tokens in
  Next's client-visible `env` configuration.
- Preserve the original fetch timestamp in every layer.
- Distinguish runtime freshness from Redis retention.
- Compress shared entries; measure actual compression rather than promise
  that a particular number of articles fits a storage budget.
- Bound retained in-memory data. Temporary files and process memory are
  accelerators, not deployment-wide persistence.
- Isolate raw maps before applying mutable view filters.
- Preserve framework control-flow exceptions; log operational failures
  instead of quietly launching an expensive full-space fallback.
- Keep deduplication and retry claims scoped to one process.

See the [cache architecture](./vercel-caching-and-isr-architecture.md) for
implemented budgets and migration behavior.

## Upstream request handling

Shared requests use an application User-Agent, ten-second per-request deadlines,
and a 25-second retry-operation budget. Retries honor `Retry-After`, use bounded
backoff, and do not retry permanent HTTP failures. Preserve those safeguards for
collection, search, metadata, and file-signing calls.

An operation containing multiple retry-wrapped requests can take longer than
one retry budget. Route timeouts still need measurement; increasing a function
duration does not address excessive crawling or memory retention.

## Staying free

The public pricing pages currently list 256 MB and 500K monthly commands for
Upstash free Redis. Vercel Hobby is personal/non-commercial and has usage
limits. Hobby cron remains daily; hourly content refresh uses ISR.

Do not automatically upgrade a plan, add a credit card, or assume paid plans
include the free allowance. Optional Blob audio and image transformations also
need usage monitoring.

Sources:

- [Upstash pricing](https://upstash.com/pricing/redis)
- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Official Notion request limits](https://developers.notion.com/reference/request-limits)
