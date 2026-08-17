# Reference captures · 2026-08

The fixed "before" for the 2026-08 visual re-exploration of the signed-in
product. Every direction in this engagement is judged against these frames,
and they are not re-taken: if the app changes underneath, this set still
records the state the exploration started from.

## How they were made

```powershell
$env:SIGNAL_ACCESS_MODE = "review"
pnpm dev --port 3510
node scripts/design/reference-shots.mjs --out=docs/design/shots/reference-2026-08
```

- Harness: `scripts/design/reference-shots.mjs` (sibling of
  `notes-shots.mjs`, widened to the whole signed-in app).
- Content: the real review-mode fixture — The Orchard, events; Mara & Finn;
  a wedding venue's live Saturday. No placeholder text anywhere.
- Four viewports, the same four the experience registry names:
  `390x844` · `768x1024` · `1280x900` · `1440x960`.
- `deviceScaleFactor: 2`, light scheme, motion allowed, the in-development
  pill dismissed the way a reviewer dismisses it.
- 104 frames + `manifest.json`.

## What is in the set

| Product | States |
|---|---|
| Home | populated, full briefing, loading |
| Tasks | board, list, schedule, calendar, my work, project, planning drawer open, task detail open, command palette, no-result search, loading |
| Notes | notebook, empty, dense, first use, long content, review, sent, loading |
| Timeline | owner, project artifact, audience manager, loading |

## The loading frames are real, not mocked

Two facts about this app decide how they were taken.

`src/app/app/layout.tsx` is `force-dynamic`, so Next never prefetches a
loading shell. **A client navigation between products therefore shows the
previous page until the next one arrives** — there is no route-level loading
frame to catch there, and the per-route `loading.tsx` files only ever paint
on a cold load. That is a finding in its own right, not a capture problem.

On a cold load the server streams the shell first: chrome, then the `/app`
Suspense fallback, then the real content in a later chunk. The harness serves
exactly that first chunk — it fetches the page's own HTML, cuts at the first
streamed replacement container, and hands the browser the prefix. Every pixel
is the product's own markup and CSS rendered by a real browser. The shipped
loading state, held still.

What that reveals: on every product the loading state is the black L plus a
single indigo dot in the middle of an empty canvas. No wordmark echo, no
shape of the thing that is coming, no words. It is the same frame in all four
products with only the top-left wordmark changing.

## Console

Clean apart from the dev-server HMR websocket
(`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`), which is the local harness
sandbox, not the app.
