# Current state — the Signal Studio application

Last updated 2026-07-30.

This repository is the unified Signal Studio application. It holds Notes, Tasks,
Timeline, and Signal as four modules behind
`app.signalstudio.ie/app/{notes,tasks,timeline,signal}`. The repository name is
historical and does not mean this is the Tasks product alone.

Latest dispatch: **T·112**, the tap-target scale correction. `CHANGELOG.md` is
the authority for what shipped and when.

Live scale hazard: the vendored design tokens remap Tailwind's numeric spacing
namespace, so `min-h-11` is 80px rather than 44px, and indices 7 through 12 are
remapped while 13 and up are stock Tailwind. Tap targets are fixed and gated;
the rest is open. Read `docs/SPACING_SCALE_COLLISION.md` before writing any
numeric spacing or sizing utility.

## Where current truth lives

| Question | Read |
|---|---|
| What shipped, and when | `CHANGELOG.md` in this repo |
| What may be claimed publicly | `studio/docs/shipped-state.md` |
| What the founder is blocking | `studio/content/hq/operator-todos/**` |
| Product and operating decisions | `studio/content/hq/decisions/**` |
| URL and naming rules | `docs/SUITE_URL_AND_NAMING_CONTRACT.md` |

This file previously carried a running narrative of cycles T-1 through T·66. It
stopped being updated in May 2026 while the dispatch record ran on to T·104, so
for two months it described a product that no longer existed. A state file that
drifts is worse than no state file. It now points at the records that are kept
current instead of restating them.
