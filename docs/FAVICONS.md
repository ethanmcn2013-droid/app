# Signal favicon contract

`src/lib/brand/suite-mark.tsx` is the artwork source for the browser icon,
Apple touch icon, install icon and ICO fallback. It is the indigo dot and
broadcast ring on white committed in Studio `839fd493` on 1 July 2026,
also preserved as `public/brand/kit/svg/mark/dot-ring-indigo.svg`.

The September 2026 repair replaced the legacy black tile with a white
triangle still present in `src/app/favicon.ico`. That stale file had SHA256
`2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932`.
Next adds this file to page metadata independently of `/icon`, so correcting
only the generated routes leaves competing artwork in the browser.

Run `pnpm brand:icons` after an intentional artwork change. It renders
`SuiteMark` through the same Next ImageResponse implementation as `/icon`
and packs 16, 32, 48 and 256 pixel PNG frames into the ICO. The generator
contains no duplicated brand colours or proportions.

`pnpm test` verifies the committed artwork seal, every generated ICO frame,
and actual image responses from `/icon`, `/apple-icon` and `/icon1`. The
guard failed against the previous triangle before regeneration. Update the
artwork seal only after reviewing the intended mark, and carry the same
change through Studio and App together.

Studio's active standalone brand pages use `assets/signal-favicon.ico`, an
identical generated copy. The documents publisher already copies relative
`assets/` references into the `growth.` and `plan.` mirrors; absolute site
paths would break those independent hosts. The default test checks the copy
and each page's favicon reference. Archived design prototypes remain dated
evidence. Signal Design System is a package and has no favicon route.

The external `ceo1.html` reference mentioned in the feedback was unavailable
in this workspace. This repair establishes consistency with the committed
mark; it does not claim an exact artwork match to that external file.
