# Social asset URLs

Render-on-demand social images, served by Next.js `ImageResponse` at
exact pixel dimensions. All routes are public (no auth) — see
`src/proxy.ts` `/social/(.*)` matcher.

| URL | Dimensions | Use |
| --- | --- | --- |
| `/social/x-banner/opengraph-image` | 1500×500 | X / Twitter banner |
| `/social/bluesky-banner/opengraph-image` | 1500×500 | Bluesky banner |
| `/social/x-pinned/opengraph-image` | 1200×675 | X pinned post image |
| `/social/bluesky-pinned/opengraph-image` | 1200×630 | Bluesky pinned post image |
| `/social/reddit-ads-wedding/opengraph-image` | 1200×628 | Reddit Ads creative (W4 paid wedding experiment) |

**To export:** open the URL in a browser → save image. Or use Playwright
`browser_navigate` + `browser_take_screenshot` against `localhost:3000`
or the deployed origin.
