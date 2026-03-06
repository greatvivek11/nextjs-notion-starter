# Next.js Notion Starter

A modern, high-performance starter kit for building websites with [Next.js](https://nextjs.org/) and using [Notion](https://www.notion.so/) as a headless CMS.

This project is a heavily optimized fork of Travis Fischer's [nextjs-notion-starter-kit](https://github.com/transitive-bullshit/nextjs-notion-starter-kit), upgraded for modern web standards.

## Key Features

- 🚀 **Framework**: Built with **Next.js 16** and **React 19**.
- 📂 **Routing**: Fully migrated to **App Router** for improved performance and developer experience.
- 🤯 **Notion-as-CMS**: Use Notion to manage your content—no database required.
- ⚡ **Performance**: 
  - **ISR (Incremental Static Regeneration)** for lightning-fast page loads with dynamic updates.
  - **Optimized Rendering**: Powered by `react-notion-x` for faithful Notion block reproduction.
- 📄 **Advanced Features**:
  - Custom **PDF Rendering** proxy to handle Notion's expiring S3 links.
  - Built-in **Search** integration with Notion API.
  - Native **RSS Feed** and **Sitemap** generation.
  - Integrated **Analytics** and **Speed Insights** via Vercel.

## Setup & Local Development

### Prerequisites
- Node.js 18+
- A Public Notion Page (to use as your root CMS page)

### Quick Start
1. **Clone and Install**:
   ```bash
   git clone https://github.com/greatvivek11/nextjs-notion-starter.git
   cd nextjs-notion-starter
   npm install
   ```

2. **Environment Variables**:
   Copy `.env.example` to `.env` and fill in your details:
   ```bash
   cp .env.example .env
   ```
   *Required*: `ROOT_NOTION_PAGE_ID` (Found in the URL of your public Notion page).

3. **Run Locally**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to see your site.

## Configuration

Most of the site's behavior is controlled via `site.config.ts`. You can configure:
- Site name, domain, and author details.
- Social links (GitHub, Twitter, LinkedIn, etc.).
- Navigation style (Default or Custom links).
- Feature toggles (LQIP images, Redis caching, etc.).

For more details, see the [Configuration Docs](docs/Project_Structure.md).

## Deployment

The easiest way to deploy is using [Vercel](https://vercel.com/):

1. Push your code to GitHub.
2. Connect your repo to Vercel.
3. Add your Environment Variables in the Vercel dashboard.

### Optimizing Vercel Deployments (CI Scoping)
By default, Vercel triggers a build for every push. To avoid unnecessary builds when only documentation (like this README) or config files change, you can scope your build.

**In Vercel Dashboard**:
Settings > Git > **Ignored Build Step**

Paste the following command:
```bash
git diff --quiet HEAD^ HEAD src/ public/ package.json next.config.js tsconfig.json site.config.ts biome.json
```
This tells Vercel to only proceed with the build if there are changes in the source code, public assets, or core configuration files.

## Credits & Documentation

- **Base Repo**: [Travis Fischer](https://github.com/transitive-bullshit/nextjs-notion-starter-kit)
- **Detailed Docs**: Explore the [/docs](docs/) folder for system architecture and component details.

## License

MIT © [Vivek Kaushik](https://github.com/greatvivek11)