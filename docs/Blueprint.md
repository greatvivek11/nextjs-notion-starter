# Project Blueprint: Onboarding Guide

Welcome to the Next.js Notion Starter project! This guide will help you get up to speed with the codebase and development workflow.

## Project Structure Overview

- `src/app`: Next.js 16 App Router pages.
- `src/components`: React components. `NotionPage.tsx` is the primary renderer.
- `src/lib`: Core logic, including Notion API wrappers, configuration, and utilities.
- `src/styles`: Global and component-specific CSS.
- `docs/`: Project documentation and guides.
- `public/`: Static assets like favicons and manifests.

## Key Configuration

### 1. `site.config.ts`
The central configuration file. Use this to define your root Notion page, site metadata, navigation links, and feature toggles (like LQIP or Redis).

### 2. Environment Variables (`.env`)
Required variables:
- `ROOT_NOTION_PAGE_ID`: The ID of your main Notion page.
- `DOMAIN`: Your site's production domain.
- `NAME`, `AUTHOR`, `DESCRIPTION`: Site metadata.

## Core Workflows

### Running Locally
```bash
npm run dev
```
The project uses `@dotenvx/dotenvx` to manage environment variables safely.

### Updating Notion Dependencies
Since this project relies on a specific fork or version of `react-notion-x` and its sub-packages, use:
```bash
npm run deps:update
```
This ensures `notion-client`, `notion-types`, and `notion-utils` stay in sync.

## Common Development Tasks

### Overriding Page URLs
You can define custom "pretty" URLs for specific Notion pages in `site.config.ts` using `pageUrlOverrides`.

### Customizing Styles
- Global Notion styles: `src/styles/notion.css`
- Component styles: `src/components/styles.module.css` (Modular CSS)

### Adding Third-Party Blocks
If you need to support new Notion blocks (e.g., specific embed types), update the `components` object in `src/components/NotionPage.tsx`.

## Debugging Tips
- **Server Side**: Check terminal logs for `[Notion API Retry]` warnings.
- **Client Side**: Relevant objects (`pageId`, `recordMap`, `block`) are attached to the `window` object in development for easy inspection.
