# NextJS Notion Starter Blog 

- This repo is based on [Travis Fischer's](https://transitivebullsh.it) - [NextJs-Notion-Starter-Kit]('https://github.com/transitive-bullshit/nextjs-notion-starter-kit'). All credit belongs to him. 😇

## Setup
1. `npm i` (use `-f` if needed. I know it's not a best practice.😅)
2. `npm run dev`
3. `npm run build`
4. `npm start`
5. `npm deploy` (requires Vercel login in cli)

### ❗️Attention❗️ [Env Vars]
  - Env vars are loaded from `next.config.js` (exposes env vars to browser) which ideally should be loaded from `.env` file, however, due to some issues I am unable to get it to work so for now this is the way.

## Key Features
- 🤯 Notion-as-CMS
- ⚡️ Next 14 Page router
- 📖 SSG at build-time.
- 🚀 ISR at runtime.
- 

## Key Differences
- Upgraded to Next 14.
- Removed yarn. Using npm.
- Removed Travis's personal info.
- Fixed Search issue.
- Fixed ISR support which somehow wasn't working! (Added runtime config for dynamic pages).
- Removed twitter integration.

## Caveats
- Requires Node server as **ISR** cannot work with static exports. [Static Export Unsupported Features ]('https://nextjs.org/docs/pages/building-your-application/deploying/static-exports#unsupported-features)
- Social Links on side don't appear on full width pages.
- Unsupported Notion features - Buttons, Link's color, Kanban boards view (status, Assigned to properties).
- If deployed to Vercel -> API functions has a free limit of 1mb. Most functions in this repo almost hit that limit. 
- Use `runtime=node` for APIs if required as `edge` runtime exceeds free tier limit of 1 mb.

## Roadmap
- To migrate to App router.
- Cleanup code.
- Webpack Module Federation to export components so that this site can be natively integrated at runtime with another site.

## SSR/SSG/ISR
- **SSR** - If you want to pre-render your site i.e., at compile time and then deploy to a static hosting platform (e.g., Github Pages), this is the approach used for this. Simply **REMOVE** the following code from `[pageId].tsx`. However, with this approach, any changes done in the Notion pages don't reflect dynamically once site is generated.
    ```
    export const config = {
        runtime: 'nodejs', // or "edge"
    }
    ```
- **ISR** - This is the _default_ approach used for this Notion-Next-CMS template. It regenerates the pages dynamically during runtime everytime there's any change in the Notion page/block/database. It **ALSO** generates pages at runtime which aren't pre-rendered using `fallback: 'blocking` property in `getStaticPaths`.


- **SSG** - If you want to render _all_ the pages dynamically at runtime, this is the approach. It is however, slow and is not SEO compatible.

    ```
    export const getServerSideProps: GetServerSideProps = async ({ req, res, params }) => {
        if (req.method !== 'GET') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.write(JSON.stringify({ error: 'method not allowed' }))
            res.end()
            return { props: {} }
        }
        const rawPageId = params?.pageId as string

        const ttlSeconds = 60

        res.setHeader(
            'Cache-Control',
            `public, max-age=${ttlSeconds}, stale-while-revalidate=${ttlSeconds}`
        )


        try {
            const props = await resolveNotionPage(domain, rawPageId)
            return { props: { ...props } }
        } catch (err) {
            console.error('page error', domain, rawPageId, err)
            throw err
        }
    }
    ```
## Docs
- [Project_Structure](docs/Project_Structure.md)
- [text](docs/Notion.md)