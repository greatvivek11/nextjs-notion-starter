# Notion

## Get RootPageId
- Any page you want to render becomes the `root` page whose child pages (including self) will be rendered in react.
- To get its id 
  1. Make it public -> Share -> Publish
  2. Get the ID from `Publish link` or click on `View Site` banner on a published page and get the Page ID from the URL.
  3. Page ID format - xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx [32 chars]

## Troubleshooting page fetch failures

The renderer uses `notion-client` and Notion's unofficial public-page API, not the
official Notion integration API.

- **403 with a Cloudflare HTML response:** Notion can reject Node.js's default
  User-Agent even for a published page. The shared client in
  [notion-api.ts](../src/lib/notion-api.ts) identifies itself as
  `nextjs-notion-starter`. A 403 is not a 429 and is not retried. If it persists,
  check publication/access and the upstream response rather than increasing retries.
- **429:** Retries honor `Retry-After` (seconds or an HTTP date). If that wait
  exceeds the remaining budget, the operation fails without retrying early.
- **Timeouts and transient failures:** Individual HTTP requests, including
  collection queries, have a 10-second abort deadline. Retry operations have a
  25-second total budget including concurrency queueing, requests, and backoff,
  with at most five attempts. SDK retries are disabled to avoid nested retries.
  These are per-operation limits, not a single deadline for an entire page's
  enrichment and navigation pipeline.
- **Build-time failures:** Failed prerenders defer to request-time rendering via
  Next.js `connection()`; they are not cached as successful HTTP 200 error pages.
  Runtime errors still propagate to Next.js error handling.

Run `npm run test:notion` to check request headers, retry classification,
`Retry-After`, in-flight cancellation, and queue expiry. When verifying a preview,
test both a cold page fetch and the rendered content; a faster 500 alone does not
mean the page-loading issue is fixed.