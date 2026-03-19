# Project Blueprint: Onboarding Guide

This guide is a practical overview of the current codebase and how to work in it.

## Project Structure Overview

- `src/app`: Next.js 16 App Router pages.
- `src/components`: React components. `NotionPage.tsx` is the primary renderer.
- `src/lib`: Core logic, including Notion API wrappers, configuration, and utilities.
- `src/styles`: Global and component-specific CSS.
- `docs/`: Project documentation and guides.
- `public/`: Static assets like favicons and manifests.

## Key Configuration

### 1. `site.config.ts`
This file is an env-backed adapter. It reads values from `process.env`, applies a few defaults, and passes them through the app's config helpers. If setup feels broken, check `.env` first.

### 2. Environment Variables (`.env`)
Required variables:
- `ROOT_NOTION_PAGE_ID`: The ID of your main Notion page.
- `DOMAIN`: Your site's production domain.
- `NAME`, `AUTHOR`, `DESCRIPTION`: Site metadata.

Common optional variables:
- `ROOT_NOTION_SPACE_ID`
- `BLOG_PAGE_ID`
- `NAVIGATION_STYLE`
- `NAVIGATION_LINKS`
- `PAGE_URL_OVERRIDES`
- `PAGE_URL_ADDITIONS`

## Core Workflows

### Running Locally
```bash
npm run dev
```
This uses Next.js' standard `.env` loading.

### Updating Notion Dependencies
There is no dedicated dependency sync script in this repo. Keep the `react-notion-x`, `notion-client`, `notion-types`, and `notion-utils` packages aligned manually when upgrading.

## Common Development Tasks

### Overriding Page URLs
You can define custom "pretty" URLs through the `PAGE_URL_OVERRIDES` env var. The value must be a JSON object whose keys are URL paths and whose values are Notion page IDs.

### Customizing Styles
- Global Notion styles: `src/styles/notion.css`
- Component styles: `src/components/styles.module.css` (Modular CSS)

### Adding Third-Party Blocks
If you need to support new Notion blocks (e.g., specific embed types), update the `components` object in `src/components/NotionPage.tsx`.

### Search and PDF behavior
- Search requests go through `src/pages/api/search-notion.ts`, which forwards queries to Notion.
- PDF blocks are rendered client-side and proxied through `src/pages/api/notion-pdf.ts` so expired Notion file URLs can be re-signed on demand.

## Debugging Tips
- **Server Side**: Check terminal logs for `[Notion API Retry]` warnings.
- **Client Side**: Relevant objects (`pageId`, `recordMap`, `block`) are attached to the `window` object in development for easy inspection.
