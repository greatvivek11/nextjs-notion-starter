# Notion Synchronization, Performance, and Architecture Fixes

**Date:** March 28, 2026

This document details a series of interrelated bugs regarding the Notion API integration, specifically related to missing articles in linked database views, a subsequent severe performance regression, and the eventual architectural refactor to guarantee stability.

---

## 1. Missing Articles in Linked Database Views (e.g., AI View)

### The Problem
When a new article was published in Notion, it would immediately appear in standard views (like "Latest") but would fail to render in linked database views (like the "AI" filtered view) for several hours.

### The Root Cause
Notion's API returns pre-computed arrays for linked database views (`page_sort` and `collection_query`). However, Notion aggressively caches these results at the edge. Even if the underlying database had the new article, the linked view's cached query result did not include the new `blockId`.

### The Solution: Proactive Discovery & Parentage Lookup
Instead of trusting the stale linked view cache, we implemented an authoritative lookup strategy:
1. **Fetch the Source of Truth:** For any linked collection encountered, instead of relying solely on `getCollectionData`, we fetch its parent database page (`fetchLinkedDatabasePages`). This endpoint returns an up-to-date, real-time list of all articles in the database.
2. **Parentage-Based Merging:** In `notion-filters.ts`, instead of restricting the filter pipeline to the IDs found in the stale linked view cache, we scan the entire retrieved `recordMap` for any block whose `parent_id` or `collection_id` matches the target collection. 
3. **Result:** The newly added article is dynamically discovered from the parent database fetch and injected into the pipeline, bypassing Notion's caching delay entirely.

---

## 2. Performance Regression on Individual Blog Posts

### The Problem
The fix for the missing articles correctly triggered fresh database fetches, but it caused the load times for *individual blog posts* to skyrocket from 1-2s to ~10-15s. Terminal logs showed the app recovering dozens of missing blocks and fetching multiple databases every time a regular article was loaded.

### The Root Cause
When calling `getPage` for a blog post (which is a row in a Notion database), Notion's API helpfully attaches the schema and views of its "parent" collection to the `recordMap`. A single blog post would inherit all 12 views defined on the main blog database, even though the blog post itself didn't render any of them.
Our previous logic iterated over `Object.keys(recordMap.collection_view)` unconditionally. Thus, a simple blog post effectively tried to re-render the entire parent database.

### The Solution: Scoping to Embedded Views
We introduced the `getEmbeddedViewIds()` utility in `notion-collections.ts`. Before deciding which databases to proactively fetch, the code traverses the page's actual content tree (`rootBlock.content`).
- It only flags `collection_view` or `collection_view_page` blocks that are **physically embedded in the page content**.
- **Blog Indexes:** Have explicitly embedded databases, so the pipeline runs, discovers new articles, and takes ~10s (cached for future loads).
- **Blog Posts:** Have zero embedded views. The pipeline is skipped entirely, restoring instantaneous 1-2s load times.

---

## 3. SOLID Refactor of `notion.ts`

### The Problem
As fixes and workarounds compound over time, `src/lib/notion.ts` ballooned to over 500 lines. It mixed API fetching, complex tree-traversal logic, date maths, cache IO, and request deduplication.

### The Solution: Modularization
The file was strictly refactored according to the Single Responsibility Principle (SRP) into distinct modules:
- **`notion.ts`** *(116 lines)*: Lean orchestrator. Checks cache, deduplicates requests, fetches, delegates collection enrichment, and runs filters.
- **`notion-collections.ts`** *(169 lines)*: Responsible for fetching embedded linked databases, extracting fresh `page_sort` arrays, and batch-recovering missing content blocks via `getBlocks()`.
- **`notion-filters.ts`** *(156 lines)*: Handles evaluating Notion's dynamic view filters (e.g., tags, date boundaries like "one month ago") against individual blocks.
- **`notion-helpers.ts`** *(77 lines)*: Pure functions for unpacking Notion's nested wrappers (`value.value`) and standardizing rich-text arrays.
- **`notion-navigation.ts`** *(37 lines)*: Responsible for fetching custom navigation headers.
- **`notion-retry.ts`** *(35 lines)*: Handles the exponential backoff, jitter, and HTTP `429 Retry-After` headers for all Notion API requests.

### Outcome
The codebase now boasts clear logic boundaries, preventing cache stamps (via `pendingPages`), resolving missing linked blocks instantly (without 429 penalties), and compiling safely with 0 TypeScript errors.
