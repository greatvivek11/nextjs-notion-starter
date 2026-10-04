# Vercel caching and ISR architecture

## Delivery and freshness

The root, article, and tag routes retain `revalidate = 3600`. ISR is
request-triggered: a page is not guaranteed to update exactly on the hour when
there is no traffic. Failed regeneration must throw rather than cache an error
UI with a successful response, allowing the last successful rendered page to
remain available.

The daily cron calls an externally configured webhook. It does not itself
invalidate paths or tags. It is distinct from ISR and should not be increased
to an hourly schedule on Hobby.

## Raw-data cache layers

[`notion-cache.ts`](../src/lib/notion-cache.ts) uses:

1. Bounded, timestamped memory caches for pages, navigation, and sitemaps.
2. Versioned JSON filesystem envelopes written atomically through temporary
   files and rename.
3. Optional shared Upstash Redis envelopes compressed with gzip/base64.

All envelopes preserve the source fetch timestamp when moving between layers.
Reading Redis, writing a local file, and build warmup do not make old content
fresh. Legacy raw-map filesystem files are cold misses, not a source of newly
dated content. Previous Redis envelopes without a version are still readable;
page/navigation lookups also recognize undashed legacy ID keys.

Page IDs are normalized to UUID form. Filesystem filenames are hashed from
logical keys; sitemap keys remain compatible with existing Redis entries.

### Limits

| Memory cache | Maximum entries | Serialized payload budget |
| --- | --- | --- |
| Pages | 64 | 32 MiB |
| Navigation | 32 | 8 MiB |
| Sitemaps | 2 | 16 MiB |

These budgets constrain retained serialized data, not exact JavaScript heap
usage. Objects, clones, compression buffers, and in-flight work consume
additional memory. Oversized values can still use disk/Redis without retention
in memory.

The runtime freshness window is one hour. Memory access also uses the existing
ten-minute source-age window. Redis retention is seven days for pages/navigation
and one day for sitemaps; retention is not the runtime freshness window.

## Build versus runtime

The Next configuration sets `NOTION_BUILD_PHASE` only in the build process,
inherited by its workers. No persistent build marker file controls runtime
behavior. Build warmup can reuse data within the Redis retention window;
production runtime still rejects raw entries older than the freshness window.

Warmup concurrency is three. Page and sitemap promise deduplication and the
request limiter operate **per process**, not across all Vercel instances.

Build/local filesystem caches use `.notion-cache` in the working directory.
Vercel runtime caches use the OS temporary directory. Neither a serverless
instance's memory nor its temporary files are durable across instances.
Redis is the shared persistence layer; Next/Vercel's rendered-page cache is the
visitor delivery layer.

## Derived views and error handling

Raw maps are isolated at cache boundaries. Each caller receives its own map
before navigation merging, relative-date filters, and tag transformations.
Concurrent callers share raw fetch work, not mutable filtered results.
Cache hits and misses both apply navigation enrichment.

Expected missing files are cache misses. Filesystem corruption/permission
errors, Redis failures, and temporary-file cleanup failures are logged.
Framework control-flow exceptions are rethrown using `unstable_rethrow`.

The Redis SDK retains `cache: 'default'`. This is an SDK fetch policy, not a
guarantee that every request is cached or that a route remains static. Confirm
actual production build output and ISR behavior on the installed Next version;
do not infer them solely from a fetch flag.

## Free-tier operations

Check actual Vercel CPU/memory/invocation, image, analytics, build, and optional
Blob usage, plus Upstash commands/storage. A cache reduces load but does not
guarantee zero cost at arbitrary traffic or make an unofficial upstream API
stable.

- [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [Cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Upstash pricing](https://upstash.com/pricing/redis)
