```
.
├── biome.json
├── docs
│   ├── Blueprint.md
│   ├── Enhancements.md
│   ├── Notion.md
│   ├── Project_Structure.md
│   ├── System_Architecture.md
│   ├── UI_Components.md
│   └── fix
├── next-env.d.ts
├── next.config.js
├── package-lock.json
├── package.json
├── public
│   ├── 404.png
│   ├── error.png
│   ├── favicon-128x128.png
│   ├── favicon-192x192.png
│   ├── favicon.ico
│   ├── favicon.png
│   ├── fonts
│   │   ├── Inter-Regular.ttf
│   │   └── Inter-SemiBold.ttf
│   └── manifest.json
├── README.md
├── site.config.ts
├── src
│   ├── app
│   │   ├── [pageId]
│   │   ├── error.tsx
│   │   ├── layout.tsx
│   │   ├── loading.tsx
│   │   ├── not-found.tsx
│   │   ├── page.tsx
│   │   ├── robots.ts
│   │   ├── sitemap.ts
│   │   └── tags
│   ├── components
│   │   ├── ErrorPage.tsx
│   │   ├── Footer.tsx
│   │   ├── Loading.tsx
│   │   ├── LoadingIcon.tsx
│   │   ├── NotionPage.tsx
│   │   ├── NotionPageHeader.tsx
│   │   ├── Page404.tsx
│   │   ├── PageActions.tsx
│   │   ├── PageAside.tsx
│   │   ├── PageHead.tsx
│   │   ├── PageSocial.module.css
│   │   ├── PageSocial.tsx
│   │   └── styles.module.css
│   ├── lib
│   │   ├── acl.ts
│   │   ├── config.ts
│   │   ├── get-canonical-page-id.ts
│   │   ├── get-config-value.ts
│   │   ├── get-page-tweet.ts
│   │   ├── get-site-map.ts
│   │   ├── get-social-image-url.ts
│   │   ├── map-image-url.ts
│   │   ├── map-page-url.ts
│   │   ├── notion-api.ts
│   │   ├── notion.ts
│   │   ├── oembed.ts
│   │   ├── preview-images.ts
│   │   ├── resolve-notion-page.ts
│   │   ├── search-notion.ts
│   │   ├── site-config.ts
│   │   ├── types.ts
│   │   └── use-dark-mode.ts
│   ├── pages
│   │   └── api
│   └── styles
│       ├── global.css
│       ├── notion.css
│       └── prism-theme.css
├── tsconfig.json
└── vercel.json

This repo is split between App Router page rendering and Pages Router API routes:

- `src/app`
  - Main page entrypoints, platform routes (`sitemap.ts`, `robots.ts`), and the dynamic Notion page/tag routes.
- `src/components`
  - Renderer composition, header/footer/sidebar UI, error/loading states, and page metadata helpers.
- `src/lib`
  - Configuration, Notion API access, URL mapping, search helpers, dark mode state, and shared types.
- `src/pages/api`
  - Search, social image, PDF proxy, cron, and page info endpoints.
- `site.config.ts`
  - Thin adapter from env vars to the internal site config shape.
- `.env.example`
  - Example runtime configuration, especially required env var names and JSON-backed options.

Useful docs:
- `docs/Notion.md`: how to obtain the root public Notion page ID
- `docs/System_Architecture.md`: request/data flow and integration points
- `docs/UI_Components.md`: renderer/layout/styling notes
- `docs/Blueprint.md`: onboarding notes for contributors
