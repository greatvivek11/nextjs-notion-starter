# Opportunities for Enhancement & Upliftment

Based on a thorough analysis of the codebase, here are several opportunities to optimize and improve the project.

## 🚀 Performance & Scaling

### 1. Redis Caching for Preview Images
The project supports LQIP (Low-Quality Image Placeholders), but caching is currently disabled (`isRedisEnabled: false` in `site.config.ts`). Enabling Redis will significantly speed up subsequent page loads by avoiding re-generating image previews.

### 2. Edge Runtime for API Routes
Several API routes (like `search-notion.ts`) could benefit from `export const runtime = 'edge'`. This reduces latency by running code closer to the user.

### 3. Consolidated PDF Proxy
The current `CustomPdf` component and `/api/notion-pdf` proxy are a great fix for expiration issues. However, we could implement a more general-purpose media proxy that handles both PDFs and large images/files consistently.

## 🛠 Code Quality & Maintainability

### 1. Type Safety in site.config.ts
Many configuration values are cast using `!!process.env.VAR` or `as any`. Moving to a validated schema (e.g., using [Zod](https://zod.dev/)) for environment variables would prevent runtime crashes due to missing config.

### 2. Consolidate API Route logic
The logic in `src/pages/api` (Pages Router) and `src/app/api` (if added) should be unified where possible to avoid duplicate logic for Notion interactions.

### 3. Comprehensive Error Boundaries
While `NotionPage` has some error handling, adding granular React Error Boundaries around specific block types (like Tweets or Collections) would prevent a single failed block from breaking the entire page render.

## ✨ Feature Additions

### 1. Automated Testing Suite
The project currently has linting and prettier checks but lacks unit or integration tests.
- **Unit Tests**: For utility functions like `map-page-url.ts` or `resolve-notion-page.ts`.
- **E2E Tests**: Using Playwright or Cypress to ensure Notion pages render correctly across different themes.

### 2. Advanced SEO & Schema.org
Expand `PageHead.tsx` to include JSON-LD structured data for blog posts (Article schema) and collections, improving search engine visibility.

### 3. Search UI Improvements
The current search integration is functional but minimal. Adding a "Command Palette" style search (like CMD+K) would greatly enhance the user experience for larger Notion workspaces.
