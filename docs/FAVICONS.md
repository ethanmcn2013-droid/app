# Signal favicon contract

`src/lib/brand/suite-mark.tsx` is the artwork source for all four icon
entry points: the browser tab icon, the Apple touch icon, the Android
install icon and the ICO fallback. The mark is a single indigo dot
(`#6366f1`, indigo-500) centred on ink (`#17171a`, `--x-studio-chrome`),
holding 40% of the canvas. The reasoning behind those two colours — in
particular why the dot is indigo-500 and not the brand's indigo-600 —
lives in `docs/brand.md` under **App icon**, and in the source comment.

## Why this file exists

`/icon`, `/icon1` and `/apple-icon` are Next routes rendered from
`SuiteMark` at request time, so they cannot drift from it. `favicon.ico`
can. It is a static file in `src/app/` that Next serves verbatim at
`/favicon.ico` for the clients that request that path directly instead of
reading the `<link rel="icon">` tag, and Next adds it to page metadata
independently of `/icon`. Change the mark and update only the routes, and
the browser is served two different pieces of artwork depending on how it
asks. That is precisely what had happened before T·153: the routes carried
the branded mark while the ICO still held a stale icon.

## Regenerating

```bash
pnpm brand:icons
```

The generator renders the real `SuiteMark` component through the same
`ImageResponse` implementation `/icon` uses and packs 16, 32, 48 and 256
pixel PNG frames into a standard ICO directory. It deliberately contains
no colours or proportions of its own — if it re-implemented the circle it
would be a second source of truth, and a second thing to forget.

Because it renders a React component through `next/og`, it needs the TS
loader: the `brand:icons` script supplies `--import tsx`. Running
`node scripts/brand/generate-favicon-ico.mjs` bare will fail.

## The gate

`scripts/brand/favicon-contract.test.mjs` runs first in `pnpm test` and
asserts four things:

1. **The artwork seal.** `suite-mark.tsx` hashes to a pinned SHA-256. Any
   edit to the mark — deliberate or accidental — fails here first.
2. **The committed ICO byte-matches a fresh render**, so a mark change
   that skips `pnpm brand:icons` cannot merge.
3. **Every ICO frame** is a well-formed PNG at its declared size, with a
   correct directory entry.
4. **`/icon`, `/apple-icon` and `/icon1`** still render the same artwork,
   at the right size and content type.

When you change the mark on purpose: edit `suite-mark.tsx`, run
`pnpm brand:icons`, **look at the rendered icon at 16px**, then re-pin
`CANONICAL_MARK_SHA256` in the contract test. The seal is a checkpoint
that forces that look, not a lock.

## Mirrors

If `public/brand/assets/` exists, the generator also writes
`signal-favicon.ico` there and the contract test asserts the copy matches.
The deck publisher copies relative `assets/` references into the static
mirror hosts, so those pages must use a relative href — an absolute site
path would break on the independent hosts. This repo currently ships no
`public/brand/` directory, so both the write and the assertion are
inert; they exist so the mirror cannot be added later without the
favicon coming with it.

Signal Design System is a package and has no favicon route.
