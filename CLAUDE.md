Design tokens are vendored at `src/ds/tokens.css` (signal-design-system;
regenerate via `scripts/ds-vendor.mjs`, never edit). Voice rules live in
`studio/BRAND.md` — not a local DESIGN.md.

Always show, never just tell: when presenting UI or design work — a
change, a review, a proposal — include visual evidence rendered from
the real app (screenshots, print PDFs, unfurl cards), captured AFTER
the final code state, at the sizes that matter. Prose describing a
pixel is not a substitute for the pixel.

## Show, don't summarise

When presenting anything to the operator — a review, a shipped change, a
proposal, a before/after — always show it visually: screenshots of the
running product (demo mode exists for exactly this), rendered pages, or
captures sent to the side panel. Prose alone is never a presentation.

## Operator guides

Step-by-step guides the operator will follow (setup walkthroughs,
runbooks with commands to type) ship as published artifacts styled with
the vendored DS tokens — Geist and Geist Mono, paper/ink neutrals,
hairlines, one indigo moment — never an ad-hoc palette. Commands the
operator types sit on dark terminal blocks with a copy control;
expected responses sit on light paper blocks; the two must never look
alike, and every snag gets its own amber-edged note naming the exact
message and its cause. Guide source is committed to `docs/guides/`;
the next guide starts from the last one's file
(`connect-claude-design.html` is the exemplar).

@AGENTS.md
